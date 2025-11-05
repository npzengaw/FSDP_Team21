import React, { createContext, useContext, useEffect, useState } from 'react';
import { websocketClient } from '../services/websocketClient';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const handleMessage = (event) => {
            const newMessage = JSON.parse(event.data);
            setMessages((prevMessages) => [...prevMessages, newMessage]);
        };

        websocketClient.addEventListener('message', handleMessage);

        return () => {
            websocketClient.removeEventListener('message', handleMessage);
            websocketClient.close();
        };
    }, []);

    const sendMessage = (message) => {
        websocketClient.send(JSON.stringify(message));
    };

    return (
        <WebSocketContext.Provider value={{ messages, sendMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};