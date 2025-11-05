import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import SupabaseProvider from './components/SupabaseProvider';
import WebSocketProvider from './components/WebSocketProvider';
import Home from './pages/Home';
import Header from './components/common/Header';
import Footer from './components/common/Footer';

const App: React.FC = () => {
  return (
    <SupabaseProvider>
      <WebSocketProvider>
        <Router>
          <Header />
          <Switch>
            <Route path="/" exact component={Home} />
          </Switch>
          <Footer />
        </Router>
      </WebSocketProvider>
    </SupabaseProvider>
  );
};

export default App;