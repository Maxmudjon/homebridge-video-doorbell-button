let Accessory, Service, Characteristic, hap, UUIDGen;
let FFMPEG = require("./ffmpeg").FFMPEG;
let dgram = require("dgram");
var gpio = require("rpi-gpio");
var express = require("express");
var app = express();
var http = require("http");

module.exports = (homebridge) => {
  Accessory = homebridge.platformAccessory;
  hap = homebridge.hap;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform("homebridge-video-doorbell-button", "Video-DoorbellV2", videoDoorbellPlatform, true);
};

let videoDoorbellPlatform = class {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.buttonState = 0;
    this.locked = 1;
    this.log.info("🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");
    this.log.info("🔔    Payziyev Maxmudjon   🔔");
    this.log.info("🔔    bio42@mail.ru        🔔");
    this.log.info("🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");

    if (this.config && this.config.event) {
      if (this.config.event.buttonSid) {
        this.serverSocket = new dgram.createSocket({
          type: "udp4",
          reuseAddr: true,
        });
        this.buttonSid = config.event.buttonSid;
        this.startServer();
      }

      if (this.config.event.gpio) {
        gpio.on("change", (channel, value) => {
          if (value == true) {
            clearTimeout(this.clickButton);
            this.clickButton = setTimeout(() => {
              this.log("GPIO button is pressed");
              this.doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(1);
            }, 100);
          }
        });
        gpio.setup(this.config.event.gpio, gpio.DIR_IN, gpio.EDGE_BOTH);
      }

      if (this.config.event.http) {
        app.get("/dingdong", (req, res) => {
          this.log("HTTP GET event");
          this.doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(1);
          res.send("Success");
        });

        app.post("/dingdong", (req, res) => {
          this.log("HTTP POST event");
          this.doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(1);
          res.send("Success");
        });

        var server = app.listen(6412, () => {
          var host = server.address().address;
          var port = server.address().port;

          this.log.info("Server listening at " + host + ":" + port);
        });
      }
    }

    if (api) {
      this.api = api;

      if (api.version < 2.1) {
        throw new Error("Unexpected API version.");
      }

      this.api.on("didFinishLaunching", (event) => this.didFinishLaunching(event));
    }
  }

  startServer() {
    this.serverSocket.on("message", (msg) => this.parseMessage(msg));
    this.serverSocket.on("error", (err) => {
      this.log.error("error, msg - %s, stack - %s\n", err.message, err.stack);
    });
    this.serverSocket.on("listening", () => {
      this.log("Aqara server is listening on port 9898.");
      this.serverSocket.addMembership("224.0.0.50");
    });
    this.serverSocket.bind({ port: 9898, exclusive: true });
  }

  parseMessage(msg, rinfo) {
    let json;
    try {
      json = JSON.parse(msg);
    } catch (ex) {
      this.log.error("Bad json %s", msg);
      return;
    }
    let cmd = json["cmd"];
    if (cmd == "report") {
      if (json.sid == this.buttonSid) {
        let data = JSON.parse(json["data"]);
        if (data.status == "click" || data.status == "double_click" || data.status == "long_click_press" || data.status == "long_click_release" || data.status == "close") {
          this.log("Mi/Aqara button is pressed");
          this.doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(1);
        }
      }
    }
  }

  configureAccessory(accessory) {}

  getLockTargetState(callback) {
    callback(null, this.locked ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);
  }

  getLockCurrentState(callback) {
    callback(null, this.locked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
  }

  setLockState(state, callback) {
    if (this.config.lock.gpio) {
      gpio.setup(this.config.lock.gpio, gpio.DIR_HIGH, write.bind(this));

      function write(err) {
        if (err) {
          this.log(err);
          return;
        }

        if (!state) {
          gpio.write(this.config.lock.gpio, true, (err) => {
            if (err) {
              this.log(err);
              return;
            }
            this.log("Written to pin High to Open");
          });

          setTimeout(() => {
            gpio.write(this.config.lock.gpio, false, (err) => {
              if (err) {
                this.log(err);
                return;
              }
              this.log("Written to pin Low to Close");
            });
          }, 500);
        }
      }
    }

    if (this.config.lock.http) {
      http
        .get(this.config.lock.http.unlock, (resp) => {
          let data = "";

          resp.on("data", (chunk) => {
            data += chunk;
          });

          resp.on("end", () => {
            this.log(data);
          });
        })
        .on("error", (error) => {
          console.log("Error: " + error.message);
        });
    }

    if (this.locked != state) {
      this.locked = state;
      this.lockService.updateCharacteristic(Characteristic.LockCurrentState, this.locked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
      this.lockService.updateCharacteristic(Characteristic.LockTargetState, this.locked ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);
      setTimeout(() => {
        if (this.locked == 1) this.locked = 0;
        else this.locked = 1;

        this.lockService.updateCharacteristic(Characteristic.LockCurrentState, this.locked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
        this.lockService.updateCharacteristic(Characteristic.LockTargetState, this.locked ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);
      }, 3000);
      callback(null, true);
    }
  }

  didFinishLaunching() {
    let videoProcessor = this.config.videoProcessor || "ffmpeg";
    let interfaceName = this.config.interfaceName || "";

    if (this.config.camera) {
      let configuredAccessories = [];

      if (!this.config.camera.name || !this.config.camera.videoConfig) {
        this.log("Missing parameters.");
        return;
      }

      let uuid = UUIDGen.generate(this.config.camera.name);
      let videoDoorbellAccessory = new Accessory(this.config.camera.name, uuid, hap.Accessory.Categories.VIDEO_DOORBELL);
      let videoDoorbellAccessoryInfo = videoDoorbellAccessory.getService(Service.AccessoryInformation);

      videoDoorbellAccessoryInfo.setCharacteristic(Characteristic.Manufacturer, "Mi/Aqara");
      videoDoorbellAccessoryInfo.setCharacteristic(Characteristic.Model, "Xiaofang");
      videoDoorbellAccessoryInfo.setCharacteristic(Characteristic.SerialNumber, this.config.event.buttonSid || "123456789");
      videoDoorbellAccessoryInfo.setCharacteristic(Characteristic.FirmwareRevision, "1.1");

      if (this.config && this.config.event && this.config.event.motion && !this.config.event.switch) {
        let button = new Service.Switch(this.config.camera.name);
        videoDoorbellAccessory.addService(button);

        let motion = new Service.MotionSensor(this.config.camera.name);
        videoDoorbellAccessory.addService(motion);

        button.getCharacteristic(Characteristic.On).on("set", this.setMotion.bind(videoDoorbellAccessory));
      }

      if (this.config && this.config.event && this.config.event.switch && !this.config.event.motion) {
        let virtualSwitch = new Service.Switch(this.config.event.switch.name);
        videoDoorbellAccessory.addService(virtualSwitch);

        virtualSwitch.getCharacteristic(Characteristic.On).on("set", this.setSwitch.bind(videoDoorbellAccessory));
      }

      let cameraSource = new FFMPEG(hap, this.config.camera.videoConfig, this.log, videoProcessor, interfaceName);
      videoDoorbellAccessory.configureCameraSource(cameraSource);

      this.doorbellService = new Service.Doorbell(this.config.camera.name);
      videoDoorbellAccessory.addService(this.doorbellService);

      if (this.config && this.config.lock) {
        this.lockService = new Service.LockMechanism(this.config.lock.name);
        this.lockService.getCharacteristic(Characteristic.LockTargetState).on("set", this.setLockState.bind(this));
        this.lockService.getCharacteristic(Characteristic.LockTargetState).on("get", this.getLockTargetState.bind(this));
        this.lockService.getCharacteristic(Characteristic.LockCurrentState).on("get", this.getLockCurrentState.bind(this));
        this.lockService.updateCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
        this.lockService.updateCharacteristic(Characteristic.LockTargetState, Characteristic.LockTargetState.SECURED);
        videoDoorbellAccessory.addService(this.lockService);
      }

      configuredAccessories.push(videoDoorbellAccessory);

      this.api.publishCameraAccessories("Camera-ffmpeg", configuredAccessories);
    }
  }

  setMotion(on, callback) {
    this.getService(Service.MotionSensor).setCharacteristic(Characteristic.MotionDetected, on ? 1 : 0);
    if (on) {
      setTimeout(() => {
        this.getService(Service.Switch).setCharacteristic(Characteristic.On, false);
      }, 5000);
    }
    callback();
  }

  setSwitch(on, callback) {
    if (on) {
      this.getService(Service.Doorbell).setCharacteristic(Characteristic.ProgrammableSwitchEvent, 1);
      setTimeout(() => {
        this.getService(Service.Switch).setCharacteristic(Characteristic.On, false);
      }, 5000);
    }
    callback();
  }
};
