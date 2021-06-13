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
        this.config = config;
        this.analyzerPerTopic = new Map();
        
        var node = this;
  
        if (config.pauseAtStartup == true) {
            node.status({fill:"yellow",shape:"ring",text:"paused"});
        }
        
        // The real logic has been encapsulated in a separate NPM package, so it can be shared between multiple of my Node-RED nodes...
        const MessageAnalyzer = require('nr-msg-statistics');
        
        class MessageSpeedAnalyzer extends MessageAnalyzer {
            calculateMsgStatistic(msg) {
                // No extra calculations required for speed, since the MessageAnalyzer class already counts all messages.
                return null;
            }

            sendMsg(msgCountInBuffer, msgStatisticInBuffer) {
                // Remark: in contradiction to the node status, we always add the interval (even if it is 1) in the msg.intervalAndFrequency
                // Because the name of the field explains that the interval is always included.
                // Remark: the msgData will be null for this node, since we don't pass any data to the analyse method (see below)
                var outputMsg = { payload: msgCountInBuffer, frequency: this.frequency, interval: this.interval, intervalAndFrequency: this.interval + " " + this.frequency};
                
                // Sending the topic only makes sence for topic dependent statistics.  Otherwise always "all_topics" will be used...
                if (node.config.topicDependent) {
                    outputMsg.topic = this.topic;
                }
                
                node.send([outputMsg, null]);
            }
     
            changeStatus(msgCountInBuffer, msgStatisticInBuffer, isStartup) {
                var status;
                
                // It has only use to update the node status, when only a single topic is being watched
                if (!node.config.topicDependent) {
                    // The status contains both the interval and the frequency (e.g. "2 hour").
                    // Except when interval is 1, then we don't show the interval (e.g. "hour" instead of "1 hour").
                    if (this.interval === 1) {
                        status = msgCountInBuffer + " / " + this.frequency;
                    }
                    else {
                        status = msgCountInBuffer + " / " + this.interval + " " + this.frequency;
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
        }

        this.on("input", function(msg) {
            var controlMsg = false;

            // When no topic-based resending (or no topic available in the msg), store all topics in the map as a single virtual topic (named 'all_topics')
            var topic = (node.config.topicDependent && msg.topic) ? msg.topic : "all_topics";
            
            // Try to get an existing analyzer for this topic
            var messageSpeedAnalyzer = node.analyzerPerTopic.get(topic);

            // When no analyzer available yet (e.g. for a new topic), then create one and store it in the map
            if (!messageSpeedAnalyzer) {
                messageSpeedAnalyzer = new MessageSpeedAnalyzer(node.config);
                messageSpeedAnalyzer.topic = topic;
                node.analyzerPerTopic.set(topic, messageSpeedAnalyzer);
                
                // When working topic dependent, show the number of topics in the node status
                if (node.config.topicDependent) {
                    node.status({fill:"green",shape:"dot",text: this.analyzerPerTopic.size + " topics"});
                }
            }
            
            // When a reset message arrives, fill the buffer with zeros to start counting all over again.
            // Remark: the disadvantage is that you will end up again with a startup period ...
            if (msg.hasOwnProperty('speed_reset') && msg.speed_reset === true) {
                // When a topic is specified in the control msg, then only that topic will be reset.  
                // Otherwise all topics will be reset...
                if (msg.topic) {
                    messageSpeedAnalyzer.reset();
                }
                else {
                    node.analyzerPerTopic.forEach(function(messageSpeedAnalyzer, topic) { 
                        messageSpeedAnalyzer.reset();
                    })
                }
                node.status({fill:"yellow",shape:"ring",text:"reset"});
                controlMsg = true;
            }
            
            // When a resume message arrives, the speed measurement will be resumed
            if (msg.hasOwnProperty('speed_resume') && msg.speed_resume === true) {
                // When a topic is specified in the control msg, then only that topic will be resumed.  
                // Otherwise all topics will be resumed...
                if (msg.topic) {
                    messageSpeedAnalyzer.resume();
                }
                else {
                    node.analyzerPerTopic.forEach(function(messageSpeedAnalyzer, topic) { 
                        messageSpeedAnalyzer.resume();
                    })
                }
                node.status({fill:"yellow",shape:"ring",text:"resumed"});
                controlMsg = true;
            }
            
            // When a pause message arrives, the speed measurement will be paused
            if (msg.hasOwnProperty('speed_pause') && msg.speed_pause === true) {
                // When a topic is specified in the control msg, then only that topic will be paused.  
                // Otherwise all topics will be paused...
                if (msg.topic) {
                    messageSpeedAnalyzer.pause();
                }
                else {
                    node.analyzerPerTopic.forEach(function(messageSpeedAnalyzer, topic) { 
                        messageSpeedAnalyzer.pause();
                    })
                }
                node.status({fill:"yellow",shape:"ring",text:"paused"});
                controlMsg = true;
            }
            
            // Don't measure control messages (i.e. messages that contain at least one of the 3 above controlling fields)
            if (controlMsg === true) {
                return;
            }
            
            messageSpeedAnalyzer.process(msg);
            
            // Send the original message on the second output port (even when the speed measurement is inactive)
            node.send([null, msg]);
        });
        
        this.on("close",function() {
            node.status({});
            
            node.analyzerPerTopic.forEach(function(messageSpeedAnalyzer, topic) { 
                messageSpeedAnalyzer.stop();
            })

            node.analyzerPerTopic.clear();
        });
    }

    RED.nodes.registerType("msg-speed", speedNode);
};
