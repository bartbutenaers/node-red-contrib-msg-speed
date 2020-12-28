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

    function speedNode(config) {
        RED.nodes.createNode(this, config);
        
        var node = this;
  
        if (config.pauseAtStartup == true) {
            node.status({fill:"yellow",shape:"ring",text:"paused"});
        }
        
        // The real logic has been encapsulated in a separate NPM package, so it can be shared between multiple of my Node-RED nodes...
        const MessageAnalyzer = require('nr-msg-statistics');
        
        class MessageSpeedAnalyzer extends MessageAnalyzer {
            calculateMsgStatistics(totalMsgCount, msg, originalMsgStatistics) {
                // No extra calculations required for speed, since the MessageAnalyzer class already counts all messages
                return null;
            }
    
            sendMsg(totalMsgCount, msgData) {
                // Remark: in contradiction to the node status, we always add the interval (even if it is 1) in the msg.intervalAndFrequency
                // Because the name of the field explains that the interval is always included.
                // Remark: the msgData will be null for this node, since we don't pass any data to the analyse method (see below)
                node.send([{ payload: totalMsgCount, frequency: this.frequency, interval: this.interval, intervalAndFrequency: this.interval + " " + this.frequency }, null]);
            }
            
            changeStatus(totalMsgCount, isStartup) {
                var status;
                
                // The status contains both the interval and the frequency (e.g. "2 hour").
                // Except when interval is 1, then we don't show the interval (e.g. "hour" instead of "1 hour").
                if (this.interval === 1) {
                    status = totalMsgCount + " / " + this.frequency;
                }
                else {
                    status = totalMsgCount + " / " + this.interval + " " + this.frequency;
                }

                // Show startup speed values in orange, and real values in green
                if (isStartup == true) {
                    if (this.ignoreStartup == true) {
                        node.status({fill:"yellow",shape:"ring",text:" start ignored" });
                    }
                    else {
                        node.status({fill:"yellow",shape:"ring",text:status });
                    }
                }
                else {
                    node.status({fill:"green",shape:"dot",text:status });
                }            
            }
        }
    
        var messageSpeedAnalyzer = new MessageSpeedAnalyzer(config);

        this.on("input", function(msg) {
            var controlMsg = false;
            
            // When a reset message arrives, fill the buffer with zeros to start counting all over again.
            // Remark: the disadvantage is that you will end up again with a startup period ...
            if (msg.hasOwnProperty('speed_reset') && msg.speed_reset === true) {
                messageSpeedAnalyzer.reset();
                node.status({fill:"yellow",shape:"ring",text:"reset"});
                controlMsg = true;
            }
            
            // When a resume message arrives, the speed measurement will be resumed
            if (msg.hasOwnProperty('speed_resume') && msg.speed_resume === true) {
                messageSpeedAnalyzer.resume();
                node.status({fill:"yellow",shape:"ring",text:"resumed"});
                controlMsg = true;
            }
            
            // When a pause message arrives, the speed measurement will be paused
            if (msg.hasOwnProperty('speed_pause') && msg.speed_pause === true) {
                messageSpeedAnalyzer.pause();
                node.status({fill:"yellow",shape:"ring",text:"paused"});
                controlMsg = true;
            }
            
            // Don't measure control messages (i.e. messages that contain at least one of the 3 above controlling fields)
            if (controlMsg === true) {
                return;
            }
            
            // In case of speed measurements, no extra data need to be stored about the input message.
            // Indeed the MssageAnalyzer already delivers the total msg count per interval, which is enough information to calculate the speed.
            messageSpeedAnalyzer.process(null);
            
            // Send the original message on the second output port (even when the speed measurement is inactive)
            node.send([null, msg]);
        });
        
        this.on("close",function() {   
            messageSpeedAnalyzer.stop();       
            node.status({});
        });
    }

    RED.nodes.registerType("msg-speed", speedNode);
};
