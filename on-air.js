const { resolve } = require('node:path');
const { spawn } = require("child_process");
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);
const { Client } = require('tplink-smarthome-api');

const DEVICE_ID = 'Basement Table Lamp'

const client = new Client();

const getLastCameraStatus = new Promise((resolve, reject) => {
    exec('log show --last 4h --predicate \'subsystem contains "com.apple.UVCExtension" and composedMessage contains "Post PowerLog"\'')
        .then((logdata) => {
            // console.log(logdata)
            const messageArray = logdata.stdout.split("\n")
            let status;
            messageArray.map((line) => {
                if (/\"VDCAssistant_Power_State\"/.test(line)) {
                const textStatus = line.split(" = ")[1];
                status = /On;/.test(textStatus);
                //   console.log(`Camera was switched ${status ? "ON" : "OFF"}`);
                }
            })
            // console.log(`Latest status is ${status ? "ON" : "OFF"}`)
            // console.log(status);

            if (status === undefined) {
                // console.log("Camera status unknown, assume it is OFF");
                status = false;
            }
            resolve(status)
        })
    })
    
// getLastLog
// .then(console.log)

const getDevice = new Promise((resolve,reject) => {
    client.startDiscovery()
    client.on('device-new', (device) => {
        // console.log(`Found device ${device.alias}`)
        if (device.alias === DEVICE_ID) {
        //   console.log('Found target device, stopping the discovery');
          client.stopDiscovery();        
          resolve(device);
        }
    })
})

// getDevice
// .then(console.log);

function watchCameraLogs(device) {
    const cameraLogWatcher = spawn('log', [
        'stream',
        // '--style=json',
        '--predicate',
        'subsystem contains \"com.apple.UVCExtension\" and composedMessage contains \"Post PowerLog\"'
      ]);
    
      cameraLogWatcher.stdout.on("data", data => {
        // console.log(`Got new log data: ${data}`);
        const messageString = data.toString().split("Post PowerLog")[1];
        const messageArray = messageString.split("\n")
        messageArray.map((line) => {
          if (/\"VDCAssistant_Power_State\"/.test(line)) {
            const textStatus = line.split(" = ")[1];
            cameraStatus = /On;/.test(textStatus);
            console.log(`Camera was just switched ${cameraStatus ? "ON" : "OFF"}`);
            device.setPowerState(cameraStatus);
            device.getPowerState().then((lightStatus) => {
              console.log(`Light is now ${lightStatus ? "ON" : "OFF"}`);
            });
          }
        })
      });
    
      cameraLogWatcher.stderr.on('data', data => {
        console.log(`stderr: ${data}`);
      });
    
      cameraLogWatcher.on('error', (error) => {
        console.log(`error: ${error.message}`);
      });
    
      cameraLogWatcher.on('close', code => {
        console.log(`Child process exited with code ${code}`);
      });
}

Promise.all([getLastCameraStatus, getDevice])
.then(([status, device]) => {
    console.log(`Camera is ${status ? "ON" : "OFF"}`);
    console.log(`Using device ${device.alias}`);
    device.setPowerState(status);
    device.getPowerState().then((status) => {
      console.log(`Light is now ${status ? "ON" : "OFF"}`);
    });
    watchCameraLogs(device);
})