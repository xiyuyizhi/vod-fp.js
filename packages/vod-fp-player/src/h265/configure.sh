#!/bin/sh

emconfigure /Users/xiyuyizhi/codeme/FFmpeg/configure \
--cc="emcc" --cxx="em++" --ar="emar" --cpu=generic --target-os=none --arch=x86_64 \
--enable-cross-compile \
--disable-inline-asm \
--disable-stripping \
--disable-ffplay \
--disable-ffprobe \
--disable-x86asm \
--disable-doc \
--disable-devices \
--disable-avdevice \
--disable-swresample \
--disable-postproc \
--disable-avfilter \
--disable-pthreads \
--disable-w32threads \
--disable-network \
--disable-hwaccels \
--disable-parsers \
--disable-debug \
--disable-indevs \
--disable-outdevs \
--disable-filters \
--disable-encoders \
--disable-decoders --enable-decoder=aac --enable-decoder=h264 \
--disable-demuxers --enable-demuxer=aac --enable-demuxer=h264 --enable-demuxer=m4v