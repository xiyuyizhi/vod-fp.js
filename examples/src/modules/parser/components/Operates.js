import Mux from 'vod-fp-mux';
import { useState, useRef } from "react"
import { Alert, Input, Button } from "antd"
import loader from 'utils/loader';

const { Probe } = Mux;

const ProbeList = [
    {
        type: 'ts',
        probe: Probe.tsProbe
    },
    {
        type: 'flv',
        probe: Probe.flvProbe
    },
    {
        type: 'mp4',
        probe: Probe.mp4Probe
    }
];


export default function Operates(props) {

    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileEle = useRef(null);

    const getUrl = e => {
        setUrl(e.target.value)
    };

    const loadSource = () => {
        if (!url) return;
        setLoading(true);
        loader(url, { responseType: 'arrayBuffer' })
            .then(res => {
                setLoading(false);
                setError(null);
                _resolveBuffer(new Uint8Array(res));
            })
            .catch(e => {
                setError(e.message)
                setLoading(false)
            });
    }

    const fileChanged = e => {
        let file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = e => {
            const buffer = new Uint8Array(e.target.result);
            _resolveBuffer(buffer);
        };
        reader.readAsArrayBuffer(file);
        fileEle.current.value = '';
    };

    const _resolveBuffer = buffer => {
        let probe = ProbeList.filter(x => {
            let ret = x.probe(buffer);
            if (/mp4/i.test(ret)) {
                x.type = ret;
            }
            if (typeof ret === 'number') return ret !== -1;
            return ret;
        }).map(x => x.type);

        if (probe.length) {
            props.recieveBuffer(buffer)
            props.updateFormat(probe[0])
            setError(null)
            return;
        }
        props.updateFormat('');
        setError('不支持的视频格式')
    }


    return <React.Fragment>
        <div>
            <Input
                placeholder="eg: find a url of  ts format file from somewhere online"
                className="normal_input"
                value={url}
                onChange={getUrl}
            />
            <Button
                type="primary"
                onClick={loadSource}
                loading={loading}
            >
                load
              </Button>
        </div>
        <div>
            <div className="upload-tips">or upload from local</div>
            <input
                ref={fileEle}
                type="file"
                className="normal_input"
                onChange={fileChanged}
            />
        </div>
        {error && <Alert message={error} type="error" />}
    </React.Fragment>

}