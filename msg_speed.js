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
    
    function resetNode(node) {
        node.circularBuffer = new CircularBuffer(node.bufferSize); 
        node.msgCount = 0;
        node.prevStartup = false;
        node.prevTotalMsgCount = 0;
        node.totalMsgCount = 0;
        node.startTime = null; // When the first (unprocessed) message has arrived
        node.endTime = null; // When the last (unprocessed) message has arrived
        node.timer = null;
    }

    function speedNode(config) {
        RED.nodes.createNode(this, config);

        this.estimationStartup = config.estimation || false;
        this.ignoreStartup = config.ignore || false;
        this.frequency = config.frequency;
        // Starting from version 0.1.0 there will be new (interval & intervalUnit) fields.
        // The value needs to correspond to the old 'frequency' field.
        // E.g. when the frequency is 'min', then the interval needs to be 1 and the intervalUnit needs to be 'min' also.
        this.interval = config.interval || 1;
        this.intervalUnit = config.intervalUnit || this.frequency;
        this.paused = false;
        
        // The buffer size depends on the specified intervalUnit
        switch(this.intervalUnit) {
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
        
        // The buffer size also depends on the specified interval length
        this.bufferSize *= this.interval;
        
        // Based on the specified frequency, the calculated speed needs to be converted.
        // E.g. interval = 15 (seconds) and frequency = seconds (= 1 second)   => speed * 1 : 15
        // E.g. interval = 15 (seconds) and frequency = minutes (= 60 seconds) => speed * 60 : 15
        switch(this.frequency) {
            case 'sec':
                this.factor = 1 / this.bufferSize; 
                break;
            case 'min':
                this.factor = 60 / this.bufferSize; 
                break;
            case 'hour':
                this.factor = 60 * 60 / this.bufferSize; 
                break;
        }
		
        resetNode(this);

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
                
                var speed = Math.floor(totalMsgCount * node.factor); 
                
                // Update the status in the editor with the last message count (only if it has changed), or when switching between startup and real
                if (node.prevTotalMsgCount != node.totalMsgCount || node.prevStartup != startup) {
                    // Show startup speed values in orange, and real values in green
                    if (startup == true) {
                        if (node.ignoreStartup == true) {
                            node.status({fill:"yellow",shape:"ring",text:" start ignored" });
                        }
                        else {
                            node.status({fill:"yellow",shape:"ring",text:" " + speed + "/" + node.frequency });
                        }
                    }
                    else {
                        node.status({fill:"green",shape:"dot",text:" " + speed + "/" + node.frequency });
                    }
                    node.prevTotalMsgCount = totalMsgCount;
                }
                
                // Send a message on the first output port, when not ignored during the startup period
                if (node.ignoreStartup == false || startup == false) {
                    node.send([{ payload: speed, frequency: node.frequency }, null]);
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
            var controlMsg = false;
            
            // When a reset message arrives, fill the buffer with zeros to start counting all over again.
            // Remark: the disadvantage is that you will end up again with a startup period ...
            if (msg.hasOwnProperty('speed_reset') && msg.speed_reset === true) {
                resetNode(node);
                
                // Stop the current timer
                clearInterval(node.timer);
                node.timer = null;
                
                node.status({fill:"yellow",shape:"ring",text:"reset"});
                    
                controlMsg = true;
            }
            
            // When a start message arrives, the speed measurement will be resumed
            if (msg.hasOwnProperty('speed_resume') && msg.speed_resume === true) {
                // Resume is only required if the node is currently paused
                if (node.paused) {
                    node.paused = false;
                    
                    // Restart the timing again as soon as the speed measurement has been resumed
                    node.startTime = new Date().getTime();
                    
                    node.status({fill:"yellow",shape:"ring",text:"resumed"});
                }

                controlMsg = true;
            }

            // When a start message arrives, the speed measurement will be paused
            if (msg.hasOwnProperty('speed_pause') && msg.speed_pause === true) {
                node.paused = true;
                    
                if (node.timer) {
                    // Stop the current timer
                    clearInterval(node.timer);
                    node.timer = null;
                    
                    node.status({fill:"yellow",shape:"ring",text:"paused"});
                }          
                
                controlMsg = true;
            }
            
            // Don't measure control messages (i.e. messages that contain at least one of the 3 above controlling fields)
            if (controlMsg === true) {
                return;
            }
            
            // Only process input messages when the speed measurement isn't paused
            if (!node.paused) {
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
            }
            
            // Send the original message on the second output port (even when the speed measurement is inactive)
            node.send([null, msg]);
        });
        
        this.on("close",function() {   
            if (node.timer) {
                // Stop the previous timer, to avoid having multiple timers running in parallel after a redeploy.
                clearInterval(node.timer);
                node.timer = null;
            }          
            node.status({});
        });
    }

    RED.nodes.registerType("msg-speed", speedNode);
};
