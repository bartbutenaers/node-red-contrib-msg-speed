# node-red-contrib-msg-speed
A Node Red node for measuring flow message speed.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-msg-speed
```
## How it works
This node will count all messages that arrive at the input port, and calculate the message speed *every second*.  

For example when the frequency is 'minute', it will count all the messages received in the *last minute*: 

![Timeline 1](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed1.png)

A second later, the calculation is repeated: again the messages received in the last minute will be counted.

![Timeline 2](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed2.png)

The measurement interval is like a **moving window**, that is being moved every second.

The process continues this way, while the moving window is discarding old messages and taking into account new messages:

![Timeline 3](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed3.png)

## Output message
+ First output: The message speed information will be send to the first output port as `msg.payload`.  This payload could be visualised e.g. in a dashboard graph:

    ![Speed chart](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed_chart.png)

    An extra `msg.frequency` field is also available (containing 'sec', 'min', 'hour').
+ Second output (since version 0.0.5): The original input message will be forwarded to this output port, which allows the speed node to be ***chained*** for better performance:

    ![Node chain](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed_chain.png)
    
    In this example we have created a single *chain of nodes*: the decoder gets images from a camera, calculates the speed and detects number plates in the images.  The original input message is passed through all the nodes, which improves performance since the large image doesn't need to be copied to new messages.
    
    The same result could be achieved (in versions < 0.0.5) by using a second wire after the decoder node:
    
    ![Parallel chaisn](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed_parallel.png)
    
    In the latter flow, Node-Red will copy the original input message to send a *cloned message* to the speed node.  This means that the original image also will be cloned, which has a negative impact on performance...
## Node status
The message speed will be displayed as node status, in the flow editor:

![Node status](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed4.png)

```
[{"id":"a50d24c0.afaf38","type":"function","z":"47b91ceb.38a754","name":"Msg factory","func":"// Repeat the msg every 50 milliseconds\nvar repeatInterval = 50;\n\nvar interval = setInterval(function() {\n    var counter = context.get('counter') || 0;\n    counter = counter + 1;\n    \n    node.send({topic: 'mytopic_' + counter});\n    \n    if(counter >= 3000) {\n        clearInterval(interval);\n        counter = 0;\n    }\n    \n    context.set('counter', counter);\n    \n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":453.76568603515625,"y":435.00000762939453,"wires":[["6e086760.71f778"]]},{"id":"da8aea7d.805558","type":"inject","z":"47b91ceb.38a754","name":"","topic":"","payload":"Start","payloadType":"str","repeat":"","crontab":"","once":false,"x":277.7657165527344,"y":435.00000762939453,"wires":[["a50d24c0.afaf38"]]},{"id":"6e086760.71f778","type":"msg-speed","z":"47b91ceb.38a754","name":"","frequency":"min","estimation":false,"ignore":false,"x":650.765625,"y":434.75,"wires":[["a5677c9a.dd884"]]},{"id":"a5677c9a.dd884","type":"ui_chart","z":"47b91ceb.38a754","name":"Messages per minute","group":"1a7f6b0.0560695","order":7,"width":0,"height":0,"label":"Messages per minute","chartType":"line","legend":"false","xformat":"HH:mm:ss","interpolate":"linear","nodata":"Messages per minute","ymin":"0","ymax":"80","removeOlder":"5","removeOlderPoints":"","removeOlderUnit":"60","cutout":0,"colors":["#1f77b4","#aec7e8","#ff7f0e","#2ca02c","#98df8a","#d62728","#ff9896","#9467bd","#c5b0d5"],"x":868.5312423706055,"y":434.5429382324219,"wires":[[],[]]},{"id":"1a7f6b0.0560695","type":"ui_group","z":"","name":"Performance","tab":"18b10517.00400b","disp":true,"width":"6"},{"id":"18b10517.00400b","type":"ui_tab","z":"","name":"Performance","icon":"show_chart"}]
```

During the startup period the message count will be displayed orange:

![Startup status](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/startup_status.png)

And when 'ignore speed during startup' is active, the node status will indicate this during the startup period:

![Ignore startup](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/startup_ignored.png)

## Startup period
The speed is being calculated every second.  As a result there will be a startup period, when the frequency is minute or hour (respectively a startup period of 60 seconds or 3600 seconds).
For example when the speed is 1 message per second, this corresponds to a speed of 60 messages per minute.  However during the first minute the speed will be incomplete:
+ After the first second, the speed is 1 message per minute
+ After the second, the speed is 2 messages per minute
+ ...
+ After one minute, the speed is 60 messages msg per minute

This means the speed will increase during the startup period, to reach the final value:

![Startup](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/Startup.png)

## Node configuration

### Frequency
The frequency ('second', 'minute', 'hour') defines the interval length of the moving window.

Caution: long intervals (like 'hour' since version **0.0.4**) will take more memory to store all the intermediate speed calculations (i.e. one calculation per second).

### Estimate speed (during startup period) - Since version 0.0.3
During the startup period, the calculated speed will be incorrect.  When estimation is activated, the final speed will be estimated during the startup period (using linear interpolation).  The graph will start from zero immediately to an estimation of the final value:

![Estimation](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/estimation.png)

Caution: estimation is very useful if the message rate is stable.  However when the message rate is very unpredictable, the estimation will result in incorrect values.  In the latter case it might be advised to enable 'ignore speed during startup'.

### Ignore speed (during startup period)  - Since version 0.0.3
During the startup period, the calculated speed will be incorrect.  When ignoring speed is activated, no messages will be send on the output port during the startup period.  This way it can be avoided that faulty speed values are generated.

Moreover during the startup period no node status would be displayed.

## Use cases
* Trigger an alarm e.g. when the message rate drops to 0 messages per minute.
* Performance measurement, e.g. track the number of images per second (received from a camera).
