const WebSocket = require('ws');
const YeeDiscovery = require('yeelight-platform').Discovery;
const YeeDevice = require('yeelight-platform').Device;

const colors = require('./colors.js');
 
const wss = new WebSocket.Server({ port: 32101 });
const discoveryService = new YeeDiscovery();

// Store discovered lights
const foundDevices = {};

// Start up discovery service for finding YeeLights
discoveryService.on('started', () => {
    console.log('** YeeLight Discovery Started **');
});
    
discoveryService.on('didDiscoverDevice', (detectedDevice) => {
    const {id, host, port, model, power, rgb} = detectedDevice;
    if(foundDevices[id]) return; //If it already exists, do nothing
    const device = new YeeDevice({host: host, port: port});
    device.connect();

    foundDevices[id] = { 
        host, 
        port, 
        model, 
        power, 
        rgb,
        device
    };
});

discoveryService.listen();
 
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
      const data = JSON.parse(message);
        switch(data.event) {
            case 'getLights':
                console.log("Getting YeeLight devices");
                getYeeLights.then(devices => {
                    let tmpObject = {}

                    const deviceKeys = Object.keys(devices);
                    const deviceKeysLength = deviceKeys.length;

                    for(let i = 0; i < deviceKeysLength; i++) {
                        tmpObject[deviceKeys[i]] = {
                            "model": devices[deviceKeys[i]].model
                        }
                    }
                    ws.send(JSON.stringify(tmpObject));
                });
                break;
            case 'changeLightColor':
                data.data.devices.forEach(device => {
                    changeLightColor(device, data.data.color);
                });
                break;
            case 'flashLights':           
                data.data.devices.forEach(device => {
                    flashColor(device, data.data.color, data.data.loopCount);
                });
                break;
            default:
                console.log("Unknown message");
                break;
        }
  });
});

const getYeeLights = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve(foundDevices);
    }, 5000);
});

const changeLightColor = (id, color) => {
    const parsedColor = color.toLowerCase();
    const convertedColor = parseInt(colors[parsedColor]);
    if(isNaN(convertedColor)) return;
    foundDevices[id].device.sendCommand({
        id: parseInt(id),
        method: 'set_rgb',
        params: [convertedColor, "smooth", 500],
    })
}

const flashColor = (id, color, loopCount = 4) => {
    const parsedColor = color.toLowerCase();
    const convertedColor = parseInt(colors[parsedColor]);
    if(isNaN(convertedColor)) return;

    foundDevices[id].device.sendCommand({
        id: parseInt(id),
        method: 'start_cf',
        params: [loopCount*2, 0, `
            250, 1, ${convertedColor}, 100, 
            250, 1, ${convertedColor}, 1
        `] // time(ms), mode(1 for color, 7 sleep), value, brightness
    })
}