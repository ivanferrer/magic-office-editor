import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? (
            <main className="fatal">
                <h1>Não foi possível exibir o editor.</h1>
                <p>
                    Feche e abra o aplicativo. Seus rascunhos salvos continuarão disponíveis no
                    histórico.
                </p>
            </main>
        ) : (
            this.props.children
        );
    }
}

createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>,
);
