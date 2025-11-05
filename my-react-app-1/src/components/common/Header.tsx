import React from 'react';

const Header: React.FC = () => {
    return (
        <header>
            <h1>My React App</h1>
            <nav>
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/chat">Chat</a></li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;