import React, { useState, useEffect, ReactNode } from 'react';
import styles from './styles.module.css';

interface TerminalProps {
    children: ReactNode;
}

interface AnimatedSpanProps {
    children: ReactNode;
    delay?: number;
    className?: string;
}

interface TypingAnimationProps {
    children: string;
    delay?: number;
    duration?: number;
    className?: string;
}

export const AnimatedSpan = ({ children, delay = 0, className }: AnimatedSpanProps) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    if (!visible) return null;

    return <div className={`${styles.line} ${className || ''}`}>{children}</div>;
};

export const TypingAnimation = ({ children, delay = 0, duration = 50, className }: TypingAnimationProps) => {
    const [text, setText] = useState('');
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const startTimer = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(startTimer);
    }, [delay]);

    useEffect(() => {
        if (!started) return;

        let currentIndex = 0;
        const interval = setInterval(() => {
            if (currentIndex <= children.length) {
                setText(children.slice(0, currentIndex));
                currentIndex++;
            } else {
                clearInterval(interval);
            }
        }, duration);

        return () => clearInterval(interval);
    }, [started, children, duration]);

    if (!started) return null;

    return (
        <div className={`${styles.line} ${className || ''}`}>
            {text}
            {text.length < children.length && <span className={styles.cursor} />}
        </div>
    );
};

export const Terminal = ({ children }: TerminalProps) => {
    return (
        <div className={styles.terminal}>
            <div className={styles.header}>
                <div className={styles.controls}>
                    <div className={`${styles.control} ${styles.close}`} />
                    <div className={`${styles.control} ${styles.minimize}`} />
                    <div className={`${styles.control} ${styles.maximize}`} />
                </div>
            </div>
            <div className={styles.content}>
                {children}
            </div>
        </div>
    );
};
