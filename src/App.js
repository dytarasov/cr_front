// src/App.js

import React, { useRef, useEffect, useState } from 'react';
import './App.css';

function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [ws, setWs] = useState(null);
  const pcRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let websocket;
    try {
      websocket = new WebSocket('wss://strangerstolk.ru/ws');
      setWs(websocket);
    } catch (error) {
      console.error('WebSocket error:', error);
      alert('Не удалось подключиться к серверу.');
      return;
    }

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      alert('Ошибка WebSocket соединения.');
    };

    websocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'waiting') {
        console.log('Ожидание собеседника...');
      } else if (data.type === 'match_found') {
        console.log('Найден собеседник, начало соединения');
        await startPeerConnection();
      } else if (data.type === 'offer') {
        if (!pcRef.current) {
          await createPeerConnection();
        }
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', answer: pcRef.current.localDescription }));
      } else if (data.type === 'answer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.type === 'candidate') {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Ошибка при добавлении ICE кандидата', e);
        }
      } else if (data.type === 'peer_left') {
        alert('Собеседник отключился.');
        handleStop();
      }
    };

    websocket.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };

    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, []);

  const createPeerConnection = async () => {
    try {
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

      pcRef.current.onconnectionstatechange = () => {
        if (pcRef.current.connectionState === 'connected') {
          console.log('Peer connected');
          setIsConnected(true);
        } else if (
          pcRef.current.connectionState === 'disconnected' ||
          pcRef.current.connectionState === 'failed' ||
          pcRef.current.connectionState === 'closed'
        ) {
          console.log('Peer disconnected');
          setIsConnected(false);
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
      localVideoRef.current.srcObject = stream;
    } catch (error) {
      console.error('Ошибка доступа к камере и микрофону.', error);
      alert('Не удалось получить доступ к камере и микрофону. Проверьте настройки.');
    }
  };

  const startPeerConnection = async () => {
    try {
      await createPeerConnection();

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', offer: pcRef.current.localDescription }));
    } catch (error) {
      console.error('Ошибка при установлении соединения:', error);
      alert('Не удалось установить соединение с собеседником.');
    }
  };

  const handleStop = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (ws) {
      ws.send(JSON.stringify({ type: 'leave' }));
    }
    setIsConnected(false);
    remoteVideoRef.current.srcObject = null;
  };

  const handleNext = () => {
    handleStop();
    if (ws) {
      ws.send(JSON.stringify({ type: 'ready' }));
    }
  };

  return (
    <div id="app-container">
      <div id="video-container">
        <video ref={remoteVideoRef} autoPlay playsInline />
        <video ref={localVideoRef} autoPlay muted playsInline />
      </div>
      <div id="controls">
        <button onClick={handleStop}>Стоп</button>
        <button onClick={handleNext}>Далее</button>
      </div>
    </div>
  );
}

export default App;
