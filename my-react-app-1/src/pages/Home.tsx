import React from 'react';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { ChatList } from '../components/Chat/ChatList';
import { ChatInput } from '../components/Chat/ChatInput';

const Home: React.FC = () => {
    return (
        <div>
            <Header />
            <main>
                <h1>Welcome to the Chat Application</h1>
                <ChatList />
                <ChatInput />
            </main>
            <Footer />
        </div>
    );
};

export default Home;