import React, { useRef, useEffect, useState } from 'react';

function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [ws, setWs] = useState(null);
  const pcRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket('wss://your_domain.ru/ws');
    setWs(ws);

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'match_found') {
        await startPeerConnection();
      } else if (data.type === 'offer') {
        await pcRef.current.setRemoteDescription(data.offer);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', answer }));
      } else if (data.type === 'answer') {
        await pcRef.current.setRemoteDescription(data.answer);
      } else if (data.type === 'candidate') {
        await pcRef.current.addIceCandidate(data.candidate);
      }
    };

    return () => ws.close();
  }, []);

  const startPeerConnection = async () => {
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:your_turn_server',
          username: 'username',
          credential: 'password',
        },
      ],
    });

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    pcRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
    localVideoRef.current.srcObject = stream;

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', offer }));
  };

  return (
    <div style={{ display: 'flex', backgroundColor: 'black', height: '100vh' }}>
      <video ref={remoteVideoRef} autoPlay style={{ width: '50%' }} />
      <video ref={localVideoRef} autoPlay muted style={{ width: '50%' }} />
      {/* Добавьте кнопки Стоп и Далее */}
      <button>Стоп</button>
      <button>Далее</button>
    </div>
  );
}

export default App;