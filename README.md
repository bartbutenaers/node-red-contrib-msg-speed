# node-red-contrib-msg-speed
A Node Red node for measuring flow message speed, i.e. the rate at which messages arrive.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-msg-speed
```

## Support my Node-RED developments

Please buy my wife a coffee to keep her happy, while I am busy developing Node-RED stuff for you ...

<a href="https://www.buymeacoffee.com/bartbutenaers" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy my wife a coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## How it works
This node will count all messages that arrive at the input port, and calculate the message speed *every second*.  

For example when the frequency is '1 minute', it will count all the messages received in the *last minute*: 

![Timeline 1](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed1.png)

A second later, the calculation is repeated: again the messages received in the last minute will be counted.

![Timeline 2](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed2.png)

The measurement interval is like a **moving window**, that is being moved every second.

The process continues this way, while the moving window is discarding old messages and taking into account new messages:

![Timeline 3](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed3.png)

## Output message
+ First output: The message speed information will be send to the first output port.  This payload could be visualised e.g. in a dashboard graph:

    ![Speed chart](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed_chart.png)

   The output message contains this fields:
   + `msg.payload` contains the measured speed, i.e. the total number of messages counted in the specified interval/frequency.
   + `msg.frequency` contains the specified frequency ('sec', 'min' or 'hour') from the config screen.
   + `msg.interval` contains the specified interval (e.g. 15) from the config screen, i.e. the length of the time window.
   + `msg.intervalAndFrequency` contains the both the interval and the frequency (e.g. '5 sec', '20 min', '1 hour').
   + `msg.topic` contains the topic for which the statistics have been calculated.  It will contain the value *"all_topics"* for the aggregated statistics of all input messages that have arrived without topic.  Note that this node only sends an `msg.topic` field in case the *"topic dependent statistics"* option has been enabled.
   
+ Second output: The original input message will be forwarded to this output port, which allows the speed node to be ***chained*** for better performance:

    ![Node chain](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed_chain.png)
    
    In this example we have created a single *chain of nodes*: the decoder gets images from a camera, calculates the speed and detects number plates in the images.  The original input message is passed through all the nodes, which improves performance since the large image doesn't need to be copied to new messages.
    
    The same result could be achieved (in versions < 0.0.5) by using a second wire after the decoder node:
    
    ![Parallel chaisn](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed_parallel.png)
    
    In the latter flow, Node-Red will copy the original input message to send a *cloned message* to the speed node.  This means that the original image also will be cloned, which has a negative impact on performance...
    
## Node status

The node status dependents on the fact whether the startup period (see next paragraph) is complete or not:
+ During the startup period the message count will be displayed orange:

   ![Startup status](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/startup_status.png)

   When 'ignore speed during startup' is active, the node status will indicate this during the startup period:

   ![Ignore startup](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/startup_ignored.png)

+ Once the startup period is completed, the nodes status depends on the  *"topic dependent statistics"* setting:
   + In case of topic independent statistics, the message speed will be displayed as node status:

      ![Node status](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed4.png)

   + In case of topic dependent statistics, the number of topics will be displayed as node status:

      ![Topic node status](https://user-images.githubusercontent.com/14224149/121797366-fe740180-cc1f-11eb-8886-e2948dc40192.png)
      
     When one or more topics are being paused, that will be indicate in the node status:
     
      ![Topic paused node status](https://user-images.githubusercontent.com/14224149/122656943-6c0fb880-d15f-11eb-851d-94fd451382ba.png)
      

## Startup period
The speed is being calculated every second.  As a result there will be a startup period, when the frequency is minute or hour (respectively a startup period of 60 seconds or 3600 seconds).
For example when the speed is 1 message per second, this corresponds to a speed of 60 messages per minute.  However during the first minute the speed will be incomplete:
+ After the first second, the speed is 1 message per minute
+ After the second, the speed is 2 messages per minute
+ ...
+ After one minute, the speed is 60 messages per minute

This means the speed will increase during the startup period, to reach the final value:

![Startup](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/Startup.png)

## Node configuration

### Frequency
The frequency (e.g. '5 second', '20 minute', '1 hour') defines the interval length of the moving window.
For example a frequency of '25 seconds' means that the average speed is calculated (every second), based on the messages arrived in the last 25 seconds.

Caution: long intervals (like 'hour') will take more memory to store all the intermediate speed calculations (i.e. one calculation per second).

### Estimate speed (during startup period)
During the startup period, the calculated speed will be incorrect.  When estimation is activated, the final speed will be estimated during the startup period (using linear extrapolation).  The graph will start from zero immediately to an estimation of the final value:

![Estimation](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/estimation.png)

Caution: estimation is very useful if the message rate is stable.  However when the message rate is very unpredictable, the estimation will result in incorrect values.  In the latter case it might be advised to enable 'ignore speed during startup'.

### Ignore speed (during startup period)
During the startup period, the calculated speed will be incorrect.  When ignoring speed is activated, no messages will be send on the output port during the startup period.  This way it can be avoided that faulty speed values are generated.

Moreover during the startup period no node status would be displayed.

### Pause measurements at startup
When selected, this node will be paused automatically at startup.  This means that the measurement calculation needs to be resumed explicit via a control message.

### Topic dependent statistics
When selected, the statistics will be stored per topic.  Which means that the speed is measured per topic.  Statistics for messages that don't contain a `msg.topic` field will stored in the ***"all_topics"*** topic.  

When not selected, the statistics for all messages will be aggregated together.  Which means that the speed is measured for all messages that arrive, regardless their `msg.topic` value.

CAUTION: this might use more system resources (e.g. RAM) in case the speed is being measured across a larger time period (e.g. per hour)!  Especially when the number of different topics is very high ...

## Control node via msg
The speed measurement can be controlled via *'control messages'*, which contains one of the following fields:
+ ```msg.speed_reset = true```: resets all measurements to 0 and starts measuring all over again.  This also means that there will again be a startup interval with temporary values!
+ ```msg.speed_pause = true```: pause the speed measurement.  This can be handy if you know in advance that - during some time interval - the messages will be arriving at abnormal speed, and therefore they should be ignored for speed calculation.  Especially in long measurement intervals, those messages could mess up the measurements for quite some time...
+ ```msg.speed_resume = true```: resume the speed measurement, when it is paused currently.

### Control with "topic dependent statistics" disabled
When topic dependent statistics are disabled, the speed is being measured for all messages that arrive (independent of their `msg.topic`).  So the control messages don't need to bother about topics.

Example flow:

![Msg control](https://user-images.githubusercontent.com/14224149/103238862-4641ed80-494c-11eb-9076-cc3673877c57.png)

```
[{"id":"21cc10a.4c6acf","type":"msg-speed","z":"7f1827bd.8acfe8","name":"","frequency":"sec","interval":"10","estimation":false,"ignore":false,"pauseAtStartup":true,"x":750,"y":1000,"wires":[["2af39912.a74596"],[]]},{"id":"c2727b62.bec668","type":"inject","z":"7f1827bd.8acfe8","name":"Generate msg every second","repeat":"1","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":350,"y":1000,"wires":[["21cc10a.4c6acf"]]},{"id":"7fc95fbc.17bcd","type":"inject","z":"7f1827bd.8acfe8","name":"Reset","repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":270,"y":1040,"wires":[["4d0ff6d5.e9bc58"]]},{"id":"4d0ff6d5.e9bc58","type":"change","z":"7f1827bd.8acfe8","name":"","rules":[{"t":"set","p":"speed_reset","pt":"msg","to":"true","tot":"bool"}],"action":"","property":"","from":"","to":"","reg":false,"x":470,"y":1040,"wires":[["21cc10a.4c6acf"]]},{"id":"8e34f29c.6a028","type":"inject","z":"7f1827bd.8acfe8","name":"Resume","repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":280,"y":1080,"wires":[["3f9d6138.9e0aae"]]},{"id":"3f9d6138.9e0aae","type":"change","z":"7f1827bd.8acfe8","name":"","rules":[{"t":"set","p":"speed_resume","pt":"msg","to":"true","tot":"bool"}],"action":"","property":"","from":"","to":"","reg":false,"x":480,"y":1080,"wires":[["21cc10a.4c6acf"]]},{"id":"5460124f.6ae8cc","type":"inject","z":"7f1827bd.8acfe8","name":"Pause","repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":270,"y":1120,"wires":[["e518e1e.79fb92"]]},{"id":"e518e1e.79fb92","type":"change","z":"7f1827bd.8acfe8","name":"","rules":[{"t":"set","p":"speed_pause","pt":"msg","to":"true","tot":"bool"}],"action":"","property":"","from":"","to":"","reg":false,"x":480,"y":1120,"wires":[["21cc10a.4c6acf"]]},{"id":"2af39912.a74596","type":"debug","z":"7f1827bd.8acfe8","name":"Speed","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":930,"y":1000,"wires":[]}]
```

### Control with "topic dependent statistics" disabled
When topic dependent statistics are enabled, the speed is calculated for every `msg.topic` that arrives.  So the control message needs to contain information about which topic needs to be controlled:
1. When the control message has its own `msg.topic` field, then only the statistics of that specific topic will be controlled.  E.g. pause only the statistics for "mytopic".
2. When the control message has no `msg.topic` field, then the statistics of **ALL** topics will be controlled!

The following example flow demonstrates how to control the topics separately or all topics at once:

![Topic msg control](https://user-images.githubusercontent.com/14224149/121797105-6aee0100-cc1e-11eb-8943-a1cb6e80a060.png)
```
[{"id":"1910e123b024237e","type":"msg-speed","z":"c9780dc5b08324c2","name":"","frequency":"sec","interval":"10","estimation":false,"ignore":false,"pauseAtStartup":false,"topicDependent":true,"x":610,"y":240,"wires":[["eb6e47c8d10c8734"],[]]},{"id":"ff11bb4a6c6a264b","type":"inject","z":"c9780dc5b08324c2","name":"Generate topic_B every second","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"1","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_B","payloadType":"date","x":320,"y":180,"wires":[["1910e123b024237e"]]},{"id":"f88046c319406e8b","type":"inject","z":"c9780dc5b08324c2","name":"Reset all topics","props":[{"p":"payload"},{"p":"speed_reset","v":"true","vt":"bool"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payloadType":"date","x":260,"y":240,"wires":[["1910e123b024237e"]]},{"id":"18ec95748e3ae9e6","type":"inject","z":"c9780dc5b08324c2","name":"Resume all topics","props":[{"p":"payload"},{"p":"speed_resume","v":"true","vt":"bool"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payloadType":"date","x":260,"y":380,"wires":[["1910e123b024237e"]]},{"id":"4d8c2932ee77c3c9","type":"inject","z":"c9780dc5b08324c2","name":"Pause all topics","props":[{"p":"payload"},{"p":"speed_pause","v":"true","vt":"bool"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payloadType":"date","x":260,"y":520,"wires":[["1910e123b024237e"]]},{"id":"0a9fbdf91facda1c","type":"debug","z":"c9780dc5b08324c2","name":"Speed topic_A","active":true,"tosidebar":true,"console":false,"tostatus":true,"complete":"true","targetType":"full","statusVal":"payload","statusType":"msg","x":1100,"y":240,"wires":[]},{"id":"16e58d2d0f3def1a","type":"inject","z":"c9780dc5b08324c2","name":"Generate topic_A every 2 seconds","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"2","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_A","payloadType":"date","x":320,"y":140,"wires":[["1910e123b024237e"]]},{"id":"eb6e47c8d10c8734","type":"switch","z":"c9780dc5b08324c2","name":"Separate topic statistics","property":"topic","propertyType":"msg","rules":[{"t":"eq","v":"topic_A","vt":"str"},{"t":"eq","v":"topic_B","vt":"str"}],"checkall":"true","repair":false,"outputs":2,"x":850,"y":240,"wires":[["0a9fbdf91facda1c"],["25f5cf52ca9809ac"]],"outputLabels":["topic_A","topic_B"]},{"id":"25f5cf52ca9809ac","type":"debug","z":"c9780dc5b08324c2","name":"Speed topic_B","active":true,"tosidebar":true,"console":false,"tostatus":true,"complete":"true","targetType":"full","statusVal":"payload","statusType":"msg","x":1100,"y":300,"wires":[]},{"id":"0793939e22527014","type":"inject","z":"c9780dc5b08324c2","name":"Reset topic_B","props":[{"p":"payload"},{"p":"speed_reset","v":"true","vt":"bool"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_B","payloadType":"date","x":250,"y":320,"wires":[["1910e123b024237e"]]},{"id":"061657c8a6c8d15a","type":"inject","z":"c9780dc5b08324c2","name":"Resume topic_B","props":[{"p":"payload"},{"p":"speed_resume","v":"true","vt":"bool"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_B","payloadType":"date","x":260,"y":460,"wires":[["1910e123b024237e"]]},{"id":"52b8eca9ccf97376","type":"inject","z":"c9780dc5b08324c2","name":"Pause topic_B","props":[{"p":"payload"},{"p":"speed_pause","v":"true","vt":"bool"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_B","payloadType":"date","x":250,"y":600,"wires":[["1910e123b024237e"]]},{"id":"10129fc00bbb5662","type":"inject","z":"c9780dc5b08324c2","name":"Reset topic_A","props":[{"p":"payload"},{"p":"speed_reset","v":"true","vt":"bool"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_A","payloadType":"date","x":250,"y":280,"wires":[["1910e123b024237e"]]},{"id":"fa9b17f9a3324c8f","type":"inject","z":"c9780dc5b08324c2","name":"Resume topic_A","props":[{"p":"payload"},{"p":"speed_resume","v":"true","vt":"bool"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_A","payloadType":"date","x":260,"y":420,"wires":[["1910e123b024237e"]]},{"id":"d2f1326cbab9d83e","type":"inject","z":"c9780dc5b08324c2","name":"Pause topic_A","props":[{"p":"payload"},{"p":"speed_pause","v":"true","vt":"bool"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"topic_A","payloadType":"date","x":250,"y":560,"wires":[["1910e123b024237e"]]}]
```

## Use cases
* Trigger an alarm e.g. when the message rate drops to 0 messages per minute.
* Performance measurement, e.g. track the number of images per second (received from a camera).
