## drm

> drm 即 Digital Rights Management.在流媒体领域，drm 即对媒体资源加密保护的一系列技术。

### drm 涉及的几个流程

**1. 加密: 加密算法都是 AES-128 对称加密**

对 hls(ts 封装格式),有两个模式:

- AES-128 即对整个分片数据加密

- SAMPLE-AES 采样级别加密,例如只对 I 帧加密,只对 1 到 10 个采样加密 详见[Encryption - Apple Developer](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/HLS_Sample_Encryption/Encryption/Encryption.html)

好莱坞级别: 一般都是 采用 iso cmff 封装格式,[common encrytion](https://www.iso.org/standard/68042.html) 定义了 cmff base 封装格式的加密规范

**2. 对加密 key 的保护,也是 drm 最重要的部分**

对 hls: m3u8 中通过 EXT-X-KEY 标记指定 key 信息,相对简单、安全性低

好莱坞级别: 好莱坞级别最重要的就是对 key 的保护程度更高,key 存储在 license server,加密阶段和解密阶段都要请求 license server 来获取 key,不同 drm 系统的差别主要就是对 key 的管理方面

**3. 解密**

对 hls: 如果是 aes-128 加密,直接对整个分片数据解密就可以了,如果是 sample-aes 模式,需要知道对分片采样的具体加密算法(具体对那部分数据进行加密),才能还原

好莱坞级别: CDM(内容解密模块,widevine fariplay 等) 拿到 key 后解密数据

### 好莱坞级别 drm

整体流程图:

![](./img/drm_1.png)

DRM System,例如 widevine、fairplay、playReady(不同浏览器平台支持不同的 DRM System. chrome -> widevine safari-> fariplay playReady-> ie11+) 主要包括两方面内容:

1、证书服务,对加密 key 的管理

2、集成于浏览器中的 CDM(content decrypt module),CDM 通过 `js EME API`来与证书服务 认证、交互 key,拿到 key 后解密音视频流

**iso bmff 中 用于 drm encryption 相关的 box**

![](./img/drm_2.png)

**四种加密方案**

![](./img/drm_4.png)

## 相关链接

[Common Encryption In ISO Base Media File Format Files](https://www.iso.org/standard/68042.html)

[Common Encryption API for Widevine DRM](https://storage.googleapis.com/wvdocs/Widevine_DRM_Encryption_API.pdf)

[What is DRM and How Does it Work?](https://bitmovin.com/what-is-drm/)

[FAQ: Digital Rights Management](https://castlabs.com/resources/faq/drm/)

[shaka packager](https://google.github.io/shaka-packager/html/tutorials/drm.html)
