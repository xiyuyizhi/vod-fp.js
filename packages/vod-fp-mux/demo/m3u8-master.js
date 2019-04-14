const master = `
#EXTM3U
## Generated with https://github.com/google/shaka-packager version v2.2.0-9e9833e-release

#EXT-X-MEDIA:TYPE=AUDIO,URI="playlist_a-spa-0128k-aac-2c.mp4.m3u8",GROUP-ID="default-audio-group",LANGUAGE="es",NAME="stream_9",AUTOSELECT=YES,CHANNELS="2"
#EXT-X-MEDIA:TYPE=AUDIO,URI="playlist_a-ita-0128k-aac-2c.mp4.m3u8",GROUP-ID="default-audio-group",LANGUAGE="it",NAME="stream_8",AUTOSELECT=YES,CHANNELS="2"
#EXT-X-MEDIA:TYPE=AUDIO,URI="playlist_a-deu-0128k-aac-2c.mp4.m3u8",GROUP-ID="default-audio-group",LANGUAGE="de",NAME="stream_4",AUTOSELECT=YES,CHANNELS="2"
#EXT-X-MEDIA:TYPE=AUDIO,URI="playlist_a-fra-0128k-aac-2c.mp4.m3u8",GROUP-ID="default-audio-group",LANGUAGE="fr",NAME="stream_7",AUTOSELECT=YES,CHANNELS="2"
#EXT-X-MEDIA:TYPE=AUDIO,URI="playlist_a-eng-0128k-aac-2c.mp4.m3u8",GROUP-ID="default-audio-group",LANGUAGE="en",NAME="stream_5",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2"
#EXT-X-MEDIA:TYPE=AUDIO,URI="playlist_a-eng-0384k-aac-6c.mp4.m3u8",GROUP-ID="default-audio-group",LANGUAGE="en",NAME="stream_6",CHANNELS="6"

#EXT-X-STREAM-INF:BANDWIDTH=829122,AVERAGE-BANDWIDTH=487252,CODECS="avc1.42c01e,mp4a.40.2",RESOLUTION=192x144,AUDIO="default-audio-group",SUBTITLES="default-text-group"
playlist_v-0144p-0100k-libx264.mp4.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4006298,AVERAGE-BANDWIDTH=1151846,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=480x360,AUDIO="default-audio-group",SUBTITLES="default-text-group"
playlist_v-0360p-0750k-libx264.mp4.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=6097200,AVERAGE-BANDWIDTH=1416075,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=640x480,AUDIO="default-audio-group",SUBTITLES="default-text-group"
playlist_v-0480p-1000k-libx264.mp4.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=8063796,AVERAGE-BANDWIDTH=1829813,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=768x576,AUDIO="default-audio-group",SUBTITLES="default-text-group"
playlist_v-0576p-1400k-libx264.mp4.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2191594,AVERAGE-BANDWIDTH=789101,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=320x240,AUDIO="default-audio-group",SUBTITLES="default-text-group"
playlist_v-0240p-0400k-libx264.mp4.m3u8


`;

export default master;
