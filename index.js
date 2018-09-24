var Accessory, hap, Service, Characteristic, UUIDGen;
var FFMPEG = require('./ffmpeg').FFMPEG;
// var rpio = require('rpio');
var dgram = require('dgram');
const serverSocket = dgram.createSocket({
  type: 'udp4',
  reuseAddr: true
});
const multicastAddress = '224.0.0.50';
const multicastPort = 4321;
const serverPort = 9898;
// var pin = 11;
// rpio.open(pin, rpio.INPUT, rpio.PULL_DOWN);

module.exports = function(homebridge) {
	Accessory = homebridge.platformAccessory;
	hap = homebridge.hap;
	Service = hap.Service;
	Characteristic = hap.Characteristic;
	UUIDGen = homebridge.hap.uuid;
	homebridge.registerPlatform("homebridge-video-doorbell", "Video-DoorbellV2", doorbellPlatform, true);
}

function doorbellPlatform(log, config, api) {
	var self = this;
	self.buttonState = 0;
	self.lockState = 1;
	self.log = log;
	self.config = config || {};

	if (api) {
		self.api = api;
		if (api.version < 2.1) {
			throw new Error("Unexpected API version.");
		}
		self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
	}

	self.log.info('🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
	self.log.info('🔔    Payziyev Maxmujon                       🔔');
	self.log.info('🔔    bio42@mail.ru                           🔔');
	self.log.info('🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
	self.startServer();
}

doorbellPlatform.prototype.startServer = function() {
	var that = this;
	serverSocket.on('message', this.parseMessage.bind(this));
	serverSocket.on('error', function(err){
		that.log.error('error, msg - %s, stack - %s\n', err.message, err.stack);
	});
	serverSocket.on('listening', function(){
		that.log.debug("Aqara server is listening on port 9898.");
		serverSocket.addMembership(multicastAddress);
	});
	serverSocket.bind(serverPort);
}

doorbellPlatform.prototype.parseMessage = function(msg, rinfo){
	var platform = this;
	var json;
	try {
		json = JSON.parse(msg);
	} catch (ex) {
		platform.log.error("Bad json %s", msg);
		return;
	}
	var cmd = json['cmd'];
	const buttonSid = platform.config.buttonSid;
	if (cmd == 'report') {
		if (json.sid == buttonSid) {
			var data = JSON.parse(json['data']);
			if (data.status == 'click' || data.status == 'double_click' || data.status == 'long_click_press' || data.status == 'long_click_release') {
				platform.buttonState = true;
			}
		}
	}
}

doorbellPlatform.prototype.identify = function (primaryService, paired, callback) {
    console.log("Identify requested!");
}

doorbellPlatform.prototype.configureAccessory = function(accessory) {

}

doorbellPlatform.prototype.getState = function (callback) {
    var self = this;
    console.log("Button state is %s", self.buttonState);
    callback(null, self.buttonState);
}

// doorbellPlatform.prototype.getLockState = function (callback) {
//     var self = this;
//     console.log("Lock state is %s", true);
//     callback(null, true);
// }

// doorbellPlatform.prototype.setLockState = function (state) {
//     var self = this;
//     if(state == true){

//     }else{
//     	console.log("Lock is locked %s", state);
//     }
// }

doorbellPlatform.prototype.didFinishLaunching = function() {
  	var self = this;

	if (self.config.cameras) {
	    var configuredAccessories = [];
	    var cameras = self.config.cameras;
	    cameras.forEach(function(cameraConfig) {
			var cameraName = cameraConfig.name;
			var videoConfig = cameraConfig.videoConfig;

			if (!cameraName || !videoConfig) {
			self.log("Missing parameters.");
			return;
			}

			var uuid = UUIDGen.generate(cameraName);
			var videodoorbellAccessory = new Accessory(cameraName, uuid, hap.Accessory.Categories.VIDEO_DOORBELL);
			var cameraSource = new FFMPEG(hap, videoConfig, self.log);

			videodoorbellAccessory.configureCameraSource(cameraSource);

			var primaryService = new Service.Doorbell(cameraName);
			primaryService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).on('get', self.getState.bind(this));

			videodoorbellAccessory.addService(primaryService);

			videodoorbellAccessory.on('identify', self.identify.bind(this, primaryService));
			    
			var speakerService = new Service.Speaker("Speaker");
			videodoorbellAccessory.addService(speakerService);

			setInterval(() => {
				if (self.buttonState) {
			  	console.log('Button is pressed')
			  	primaryService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(1);
			  	self.buttonState = false;
			}
			},100)

			videodoorbellAccessory.getService(Service.AccessoryInformation)
				.setCharacteristic(Characteristic.Manufacturer, "Mi/Aqara")
				.setCharacteristic(Characteristic.Model, "Doorbell")
				.setCharacteristic(Characteristic.SerialNumber, self.config.buttonSid);

			// var lockService = new Service.LockMechanism("Замок Домофона");
			// lockService.getCharacteristic(Characteristic.LockTargetState).on('set', self.setLockState.bind(this));
			// lockService.getCharacteristic(Characteristic.LockTargetState).on('get', self.getLockState.bind(this));
			// lockService.getCharacteristic(Characteristic.LockCurrentState).on('get', self.getLockState.bind(this));
			// videodoorbellAccessory.addService(lockService);

			// function pollcb(cbpin)
			//   {
			//   	var state = rpio.read(cbpin) ? 'pressed' : 'released';
			//       console.log('Button event on P%d (button currently %s)', cbpin, state);

			//       if(state == 'pressed') {
			//           primaryService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(1);
			//           setTimeout(function () {
			                  
			//           }, 100)
			//       }
			//   }

			// rpio.poll(pin, pollcb);
			configuredAccessories.push(videodoorbellAccessory);
	    });
    	self.api.publishCameraAccessories("Camera-ffmpeg", configuredAccessories);
	}
}