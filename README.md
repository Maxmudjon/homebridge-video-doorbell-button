# homebridge-video-foorbell

ffmpeg plugin for [Homebridge](https://github.com/nfarina/homebridge)

## Installation

1. Install ffmpeg on your Mac
2. Install this plugin using: npm install -g homebridge-video-doorbell
3. Edit ``config.json`` and add the camera and add Mi/Aqara Button.
3. Run Homebridge
4. Add extra camera accessories in Home app. The setup code is the same as homebridge.

### Config.json Example

``
{
  "platform": "Video-DoorbellV2",
  "buttonSid": "158d00015cc8ac",
  "cameras": [{
    "name": "Домофон",
    "videoConfig": {
      "source": "-rtsp_transport tcp -y -i rtsp://192.168.1.13/unicast",
      "maxStreams": 2,
      "maxWidth": 1280,
      "maxHeight": 720,
      "maxBitrate": 1600,
      "maxFPS": 20,
      "audio": true,
      "vcodec": "h264_omx"
    }
  }]
}
``
Incidentally, check [iSpyConnect's camera database](https://www.ispyconnect.com/sources.aspx) to find likely protocols and URLs to try with your camera.
