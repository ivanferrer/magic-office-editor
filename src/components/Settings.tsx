import { useState } from 'react';
import { KeyRound, ShieldCheck, PlugZap } from 'lucide-react';
import { Modal } from './Modal';
import type { AISettings, NativeAPI } from '../shared/types';

export function Settings({
    api,
    initial,
    onClose,
    onSaved,
}: {
    api: NativeAPI;
    initial: AISettings;
    onClose: () => void;
    onSaved: (settings: AISettings) => void;
}) {
    const [value, setValue] = useState<AISettings>({ ...initial, apiKey: '' });
    const [message, setMessage] = useState('');
    const [models, setModels] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    async function save(test = false) {
        setBusy(true);
        setMessage('');
        try {
            const saved = await api.saveSettings(value);
            onSaved(saved);
            setValue({ ...saved, apiKey: '' });
            if (test) {
                const names = await api.testConnection();
                setModels(names);
                setMessage(
                    names.length
                        ? `Conexão funcionando. ${names.length} modelo(s) disponível(is).`
                        : 'Conexão funcionando. Nenhum modelo instalado ou listado.',
                );
            } else onClose();
        } catch (error: any) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <Modal title="Sua IA, do seu jeito" onClose={onClose}>
            <p className="muted">
                O editor funciona sem IA. A revisão só envia texto quando você clicar em Revisar.
            </p>
            <fieldset disabled={busy}>
                <label>
                    Onde a IA vai rodar?
                    <select
                        value={value.provider}
                        onChange={(e) => {
                            const local = e.target.value === 'ollama';
                            setValue({
                                provider: local ? 'ollama' : 'compatible',
                                endpoint: local
                                    ? 'http://127.0.0.1:11434'
                                    : 'https://api.openai.com/v1',
                                model: local ? 'qwen3:8b' : 'gpt-4.1-mini',
                                apiKey: '',
                                hasKey: false,
                                clearKey: true,
                            });
                            setModels([]);
                        }}
                    >
                        <option value="ollama">Ollama — no meu computador</option>
                        <option value="compatible">Serviço por API — compatível com OpenAI</option>
                    </select>
                </label>
                <label>
                    Endereço do serviço
                    <input
                        value={value.endpoint}
                        onChange={(e) =>
                            setValue({
                                ...value,
                                endpoint: e.target.value,
                                hasKey: false,
                                clearKey: true,
                            })
                        }
                        placeholder="https://api.exemplo.com/v1"
                    />
                </label>
                <label>
                    Modelo
                    <input
                        list="ai-models"
                        value={value.model}
                        onChange={(e) => setValue({ ...value, model: e.target.value })}
                        placeholder="Nome exato do modelo"
                    />
                    <datalist id="ai-models">
                        {models.map((model) => (
                            <option key={model} value={model} />
                        ))}
                    </datalist>
                </label>
                {value.provider === 'compatible' && (
                    <label>
                        Chave de API{' '}
                        <span className="muted">{value.hasKey ? '(já armazenada)' : ''}</span>
                        <div className="key-input">
                            <KeyRound size={16} />
                            <input
                                type="password"
                                autoComplete="off"
                                value={value.apiKey ?? ''}
                                placeholder={
                                    value.hasKey
                                        ? 'Deixe vazio para manter a chave atual'
                                        : 'Cole sua chave aqui'
                                }
                                onChange={(e) =>
                                    setValue({ ...value, apiKey: e.target.value, clearKey: false })
                                }
                            />
                        </div>
                        {value.hasKey && (
                            <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                    setValue({
                                        ...value,
                                        clearKey: true,
                                        hasKey: false,
                                        apiKey: '',
                                    })
                                }
                            >
                                Remover chave salva
                            </button>
                        )}
                    </label>
                )}
            </fieldset>
            <div className="info-box">
                <ShieldCheck size={20} />
                <div>
                    {value.provider === 'ollama' ? (
                        <>
                            Para uso local, instale o Ollama e baixe um modelo, por exemplo{' '}
                            <code>ollama pull qwen3:8b</code>. O desempenho depende do computador.
                            Use um modelo que consiga produzir JSON.
                        </>
                    ) : (
                        <>
                            O trecho revisado será enviado ao provedor configurado, que pode cobrar
                            pelo uso. A chave fica protegida pelo sistema operacional e não faz
                            parte dos documentos.
                        </>
                    )}
                </div>
            </div>
            {message && (
                <p className="form-message" role="status">
                    {message}
                </p>
            )}
            <div className="modal-actions">
                <button className="button" disabled={busy} onClick={() => save(true)}>
                    <PlugZap size={16} />
                    {busy ? 'Conectando…' : 'Salvar e testar conexão'}
                </button>
                <button
                    className="button primary"
                    disabled={busy || !value.model.trim()}
                    onClick={() => save()}
                >
                    Salvar configurações
                </button>
            </div>
        </Modal>
    );
}
