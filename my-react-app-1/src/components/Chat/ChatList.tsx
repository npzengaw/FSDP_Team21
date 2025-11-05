import React, { useContext } from 'react';
import { WebSocketContext } from '../WebSocketProvider';

const ChatList: React.FC = () => {
    const { messages } = useContext(WebSocketContext);

    return (
        <div className="chat-list">
            {messages.map((message, index) => (
                <div key={index} className="chat-message">
                    <strong>{message.sender}:</strong> {message.content}
                </div>
            ))}
        </div>
    );
};

export default ChatList;