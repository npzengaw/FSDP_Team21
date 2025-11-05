import React, { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

const ChatInput: React.FC = () => {
    const [message, setMessage] = useState('');
    const { sendMessage } = useWebSocket();

    const handleSendMessage = () => {
        if (message.trim()) {
            sendMessage(message);
            setMessage('');
        }
    };

    return (
        <div>
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
            />
            <button onClick={handleSendMessage}>Send</button>
        </div>
    );
};

export default ChatInput;