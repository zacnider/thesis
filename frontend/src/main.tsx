import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WalletConnectProvider } from '@btc-vision/walletconnect';
import { ProviderContextProvider } from './context/ProviderContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WalletConnectProvider theme="dark">
            <ProviderContextProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </ProviderContextProvider>
        </WalletConnectProvider>
    </React.StrictMode>,
);
