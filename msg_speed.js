/**
 * Copyright 2017 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
module.exports = function(RED) {
    "use strict";
    var CircularBuffer = require("circular-buffer");
    var Math = require("mathjs");

    function speed(config) {
        RED.nodes.createNode(this, config);
        
        this.estimationStartup = config.estimation || false;
        this.ignoreStartup = config.ignore || false;
        
        // Migration of old nodes which don't have an interval yet (so interval is always 1)
        if(!config.interval) { 
            this.interval = 1
        }
        else {
            this.interval = parseInt(config.interval);
        }

        // The buffer size depends on the frequency
        switch(config.frequency) {
            case 'sec':
                this.bufferSize = 1; 
                break;
            case 'min':
                this.bufferSize = 60;
                break;
            case 'hour':
                this.bufferSize = 60 * 60;
                break;
            default:
                this.bufferSize = 1; // Default 'sec'
        }
        
        this.bufferSize *= this.interval;
		
        this.circularBuffer = new CircularBuffer(this.bufferSize);
        
        this.frequency = config.frequency || 'sec';
        this.msgCount = 0;
        this.prevStartup = false;
        this.prevTotalMsgCount = 0;
        this.totalMsgCount = 0;
        this.startTime = null; // When the first (unprocessed) message has arrived
        this.endTime = null; // When the last (unprocessed) message has arrived
        this.timer = null;

        var analyse = function() {
            if (node.startTime == null) {
                node.startTime = new Date().getTime();
            } 
            
            // Register the time when the last message has arrived (or when the last timer was called, when no message has arrived)
            node.endTime = new Date().getTime();
                        
            // Calculate the time interval (in seconds) since the first (unprocessed) message has arrived
            var seconds = (node.endTime - node.startTime) / 1000;
            var remainder = (seconds - Math.floor(seconds)) * 1000;
            seconds = Math.floor(seconds);
            
            // Correct the end time with the remainder, since the time interval since the last message (until now) is skipped in the current calculation.
            // Otherwise timeslices will get behind, and the curve would have some overshoot (at startup) period before reaching the final speed.
            node.endTime -= remainder;
            
            //console.log(seconds + " seconds between " + new Date(node.startTime).toISOString().slice(11, 23) + " and " + new Date(node.endTime).toISOString().slice(11, 23));
            
            // Store the message count (of the previous second) in the circular buffer.  However the timer can be
            // delayed, so make sure this is done for EVERY second since the last time we got here ...
            // 10 images/2,5 seconds = 240 images/second           
            for(var i = 0; i < seconds; i++) {
                var original = node.totalMsgCount;
                // In the first second we store (the count of) all received messages, except the last one (that has been received in the next second).
                // In the next second we store that remaining (single) last message.  In all later seconds (of this loop) we will store 0.
                var added = (i == 0) ? Math.max(0, node.msgCount - 1) : Math.max(0, node.msgCount);

                // Check the content of the tail buffer cell (before it is being removed by inserting a new cell at the head), if available already
                var removed = (node.circularBuffer.size() >= node.bufferSize) ? node.circularBuffer.get(node.bufferSize-1) : 0;
                
                // The total msg count is the sum of all message counts in the circular buffer.  Instead of summing all those
                // buffer cells continiously (over and over again), we will update the sum together with the buffer content.
                // Sum = previous sum + message count of last second (which is going to be added to the buffer) 
                //                    - message count of the first second (which is going to be removed from the buffer).
                node.totalMsgCount = original + added - removed;
                //console.log(node.totalMsgCount + " = " + original + " + " + added + " - " + removed);
                
                // Store the new count in the circular buffer (which will also trigger deletion of the oldest cell at the buffer trail)
                node.circularBuffer.enq(added); 
                
                var totalMsgCount = node.totalMsgCount;
                var startup = false;
                
                // Do a linear interpolation if required (only relevant in the startup period)
                if (node.circularBuffer.size() < node.circularBuffer.capacity()) {
                     startup = true;

                     if (node.estimationStartup == true && node.circularBuffer.size() > 0) {
                        totalMsgCount = Math.floor(totalMsgCount * node.circularBuffer.capacity() / node.circularBuffer.size());
                    }
                }
                
                // Update the status in the editor with the last message count (only if it has changed), or when switching between startup and real
                if (node.prevTotalMsgCount != node.totalMsgCount || node.prevStartup != startup) {
                    var status;
                    
                    // The status contains both the interval and the frequency (e.g. "2 hour").
                    // Except when interval is 1, then we don't show the interval (e.g. "hour" instead of "1 hour").
                    if (node.interval === 1) {
                        status = totalMsgCount + " / " + node.frequency;
                    }
                    else {
                        status = totalMsgCount + " / " + node.interval + " " + node.frequency;
                    }
                    
                    
                    // Show startup speed values in orange, and real values in green
                    if (startup == true) {
                        if (node.ignoreStartup == true) {
                            node.status({fill:"yellow",shape:"ring",text:" start ignored" });
                        }
                        else {
                            node.status({fill:"yellow",shape:"ring",text:status });
                        }
                    }
                    else {
                        node.status({fill:"green",shape:"dot",text:status });
                    }
                    
                    node.prevTotalMsgCount = totalMsgCount;
                }
                
                // Send a message on the first output port, when not ignored during the startup period
                if (node.ignoreStartup == false || startup == false) {
                    // Remark: in contradiction to the node status, we always add the interval (even if it is 1) in the msg.intervalAndFrequency
                    // Because the name of the field explains that the interval is always included.
                    node.send([{ payload: totalMsgCount, frequency: node.frequency, interval: node.interval, intervalAndFrequency: node.interval + " " + node.frequency }, null]);
                }
                
                node.prevStartup = startup;
                
                // The message count that has already been added, shouldn't be added again the next second
                node.msgCount = Math.max(0, node.msgCount - added);
            }
            
            if (seconds > 0) {
                // Our new second starts at the end of the previous second
                node.startTime = node.endTime;
            }
        }

        var node = this;

        this.on("input", function(msg) {
            if (node.timer) {
                // An msg has arrived during the specified (timeout) interval, so remove the (timeout) timer.
                clearInterval(node.timer);
            }           

            node.msgCount += 1;
            //console.log("New msg arrived resulting in a message count of " + node.msgCount );
            
            analyse();

            // Register a new timer (with a timeout interval of 1 second), in case no msg should arrive during the next second.
            node.timer = setInterval(function() {
                //console.log("Timer called.  node.msgCount  = " + node.msgCount );
                
                // Seems no msg has arrived during the last second, so register a zero count
                analyse();
            }, 1000);
            
            // Send the original message on the second output port
            node.send([null, msg]);
        });
        
        this.on("close",function() {   
            if (node.timer) {
                // Stop the previous timer, to avoid having multiple timers running in parallel after a redeploy.
                clearInterval(node.timer);
            }          
            node.status({});
        });
    }

    RED.nodes.registerType("msg-speed", speed);
};
