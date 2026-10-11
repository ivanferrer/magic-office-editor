import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
    title,
    children,
    onClose,
    wide = false,
}: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        ref.current?.showModal();
    }, []);
    return (
        <dialog
            ref={ref}
            className={`modal ${wide ? 'wide' : ''}`}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="modal-head">
                <h2>{title}</h2>
                <button className="icon-button" title="Fechar" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>
            {children}
        </dialog>
    );
}
