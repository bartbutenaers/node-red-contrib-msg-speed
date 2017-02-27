# node-red-contrib-msg-speed
A Node Red node for measuring flow message speed.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-msg-speed
```

## Usage
This node will count all messages that arrive at the input port, and calculate the message speed *every second*.  

For example when the frequency is 'minute', it will count all the messages received in the *last minute*: 

![Timeline 1](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed1.png)

A second later, the calculation is repeated: again the messages received in the last minute will be counted.

![Timeline 2](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed2.png)

The measurement interval is like a **moving window**, that is being moved every second.

The process continues this way, while the moving window is forgetting old messages and taking into account new messages:

![Timeline 3](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed3.png)

Remark: The message count will be displayed on the screen:

![Timeline 4](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-msg-speed/master/images/speed4.png)

Moreover the message count will be send to the output port as message payload.  An extra 'frequency' message field is also added (containing 'sec', 'min', 'hour', 'day').

Some use cases: 
* Trigger an alarm e.g. when the message rate drops to 0 messages per minute.
* Performance measurement, e.g. track the number of images per second (received from a camera).

## Node configuration

### Frequency
The frequency ('second', 'minute', 'hour', 'day') defines the interval length of the moving window.

Remark: when the interval becomes longer, more calculations need to be stored into memory...
