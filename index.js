const fs = require('fs');
const exec = require('child_process').exec;
const fetch = require('node-fetch');
const Gpio = require('pigpio').Gpio;

/*********/
const brewingTemp = 88;
const brewedTemp = 93;
const brewOffset = 45 * 60000;
const filePath = '/sys/bus/w1/devices/28-031702a501ff/w1_slave';

const slackMessage = {
    "username": "Coffee Bot",
	"text": "There's fresh coffee! Get it while it's good."
}
const slackHook = '';
/*********/

const led = new Gpio(21, {mode: Gpio.OUTPUT});

const readFile = path => new Promise((resolve, reject) => {
    fs.readFile(path, (err, file) => {
        if (err) {
            return reject(err);
        }
        return resolve(file);
    });
});

const getTempFromFile = file => {
    return file.slice(file.indexOf('t=') + 2) / 1000;
}

const toF = temp => temp * 1.8 + 32;

const isCoffeeReady = (temp, period) => {  
    if (temp > brewedTemp) {
        //if (period > 2) {
            return true
        //}
    }

    if (temp > brewingTemp) {
        return 'almost';
    }      

    return false
}

let state = {
    //period: 0,
    lastBrew: 0,
    led: 1,
    blink: null
}

let inter = () => {
    setInterval(() => {
        if(state.lastBrew + brewOffset <= Date.now()) {
            readFile(filePath)
            .then(file => {
                const temp = toF(getTempFromFile(file));
                const ready = isCoffeeReady(temp);

                if (ready === true) {
                    //state.period = 0;
                    clearInterval(state.blink);
                    state.blink = null;
                    state.lastBrew = Date.now();
                    state.led = 1;
                    
                    led.digitalWrite(state.led);
                    fetch(slackHook, { method: 'POST', body: JSON.stringify(slackMessage) });
                    
                    console.log('ready', temp);
                }
                else if (ready === 'almost') {
                    console.log('almost', temp);
                    //state.period += 1;
                    if (state.blink === null) {
                        state.blink = setInterval(() => {
                            state.led = !state.led;
                            led.digitalWrite(state.led)
                        }, 800);
                    }
                }
                else {
                    console.log('not-brewing', temp);
                } 
            })
            .catch(err => {
                console.log(err);
            });
        }
        else {
            console.log("Just brewed... I think I'll wait a bit");
        }
    }, 10000);
}

exec('modprobe w1-gpio && modprobe w1-therm', (err, stdout, stderr) => {
    if (err) {
        console.log(`Couldn't run exec`);
        return;
    }
    led.digitalWrite(state.led)
    inter();
});