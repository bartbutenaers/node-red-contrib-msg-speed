module.exports = function(RED) {
    "use strict";
    var CircularBuffer = require("circular-buffer");
    var Math = require("mathjs");

    function speed(config) {
        RED.nodes.createNode(this, config);

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
		
        this.circularBuffer = new CircularBuffer(this.bufferSize);
        
        // Fill the buffer with zeros
        for (var i = 0; i < this.bufferSize; i++) {
			this.circularBuffer.enq(0);
		}
        
        this.frequency = config.frequency || 'sec';
        this.msgCount = 0;
        this.prevTotalMsgCount = 0;
        this.totalMsgCount = 0;
        this.startTime = null;
        this.timer = null;

        var analyse = function() {
            var currentTime = new Date().getTime();

            if (node.startTime == null) {
                node.startTime = currentTime;
            } 

            // Store the message count (of the previous second) in the circular buffer.  However the timer can be
            // delayed, so make sure this is done for EVERY second since the last time we got here ...
            var seconds = Math.floor((currentTime - node.startTime) / 1000); 
            for(var i = 0; i < seconds; i++) {
                // The total msg count is the sum of all message counts in the circular buffer.  Instead of summing
                // those continiously, we will update the sum together with the buffer content.
                // Sum = previous sum + message count of last second (which is going to be added to the buffer) 
                //                    - message count of the first second (which is going to be removed from the buffer).
                node.totalMsgCount += node.msgCount;
                node.totalMsgCount -= node.circularBuffer.get(node.bufferSize-1);
                //console.log("node.msgCount  = " + node.msgCount + " and node.totalMsgCount = " + node.totalMsgCount );
                
                node.circularBuffer.enq(node.msgCount); 
                
                // Update the status in the editor with the last message count (only if it has changed)
                if (node.prevTotalMsgCount != node.totalMsgCount) {
                    node.status({fill:"green",shape:"dot",text:" " + node.totalMsgCount + "/" + node.frequency });
                    node.prevTotalMsgCount = node.totalMsgCount;
                }
                
                node.send({ payload: node.totalMsgCount, frequency: node.frequency });
                
                if (RED.settings.verbose) {
                    console.log(new Date().toISOString() + " " + node.totalMsgCount);
                }
                
                // Start counting all over again (for the next seconds)
                node.msgCount = 0;
                node.startTime = currentTime;
            }
        }

        var node = this;

        // Initially display a 0 count
        node.status({fill:"green",shape:"dot",text:" " + node.msgCount + "/" + node.frequency });

        this.on("input", function(msg) {
            if (node.timer) {
                // An msg has arrived during the specified (timeout) interval, so remove the (timeout) timer.
                clearInterval(node.timer);
            }           

            node.msgCount += 1;
            //console.log("New msg arrived.  node.msgCount  = " + node.msgCount );
            
            analyse();

            // Register a new timer (with a timeout interval of 1 second), in case no msg should arrive during the next second.
            node.timer = setInterval(function() {
                //console.log("Timer called.  node.msgCount  = " + node.msgCount );
                
                // Seems no msg has arrived during the last second, so register a zero count
                analyse();
            }, 1000);
        });
    }

    RED.nodes.registerType("msg-speed", speed);
};
