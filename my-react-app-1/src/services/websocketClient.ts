import { useEffect, useRef } from 'react';

const useWebSocket = (url) => {
    const socketRef = useRef(null);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        socketRef.current = new WebSocket(url);

        socketRef.current.onmessage = (event) => {
            const newMessage = JSON.parse(event.data);
            setMessages((prevMessages) => [...prevMessages, newMessage]);
        };

        return () => {
            socketRef.current.close();
        };
    }, [url]);

    const sendMessage = (message) => {
        if (socketRef.current) {
            socketRef.current.send(JSON.stringify(message));
        }
    };

    return { messages, sendMessage };
};

export default useWebSocket;