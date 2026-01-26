'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    FiArrowUp,
    FiPlus,
    FiX,
    FiFile,
} from 'react-icons/fi';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

async function convertFilesToDataURLs(files: FileList) {
    return Promise.all(
        Array.from(files).map(
            (file) =>
                new Promise<{
                    type: 'file';
                    mediaType: string;
                    url: string;
                }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () =>
                        resolve({
                            type: 'file',
                            mediaType: file.type,
                            url: reader.result as string,
                        });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                }),
        ),
    );
}

interface ChatInputProps {
    onSend: (data: { text?: string; parts?: any[] }) => void;
    disabled?: boolean;
    status: 'ready' | 'submitted' | 'streaming' | 'error';
}

export default function ChatInput({ onSend, disabled, status }: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [files, setFiles] = useState<FileList | undefined>();
    const [input, setInput] = useState('');

    const isPending = status === 'submitted' || status === 'streaming';
    const fileArray = files ? Array.from(files) : [];

    const handleSend = async () => {
        const value = input.trim();
        if (!value && !fileArray.length) return;

        const fileParts = files ? await convertFilesToDataURLs(files) : [];

        onSend({
            parts: [
                ...(value ? [{ type: 'text', text: value }] : []),
                ...fileParts,
            ],
        });

        setInput('');
        setFiles(undefined);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="fixed bottom-8 left-0 right-0 py-8 px-4 flex justify-center z-50 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pointer-events-none w-full">
            <div className="w-full max-w-3xl pointer-events-auto">
                <div
                    className="
          bg-white dark:bg-zinc-900
          rounded-xl border-2
          border-gray-400 dark:border-zinc-700
          shadow-xl
          hover:border-gray-500 dark:hover:border-zinc-600
          transition-colors
        "
                >
                    <div className="flex flex-col">
                        {/* FILE PREVIEW (INSIDE INPUT) */}
                        {fileArray.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-2 pt-2">
                                {fileArray.map((file, idx) => {
                                    const isImage = file.type.startsWith('image/');
                                    const previewUrl = isImage
                                        ? URL.createObjectURL(file)
                                        : null;

                                    return (
                                        <div
                                            key={idx}
                                            className="
                      relative group
                      rounded-lg border border-zinc-300 dark:border-zinc-700
                      bg-zinc-50 dark:bg-zinc-800
                      overflow-hidden
                    "
                                        >
                                            {isImage && previewUrl ? (
                                                <div className="relative h-10 w-10">
                                                    <Image
                                                        src={previewUrl}
                                                        alt={file.name}
                                                        fill
                                                        sizes="20px"
                                                        className="object-cover"
                                                        onLoad={() => {
                                                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-2 py-1.5 max-w-[160px]">
                                                    <FiFile className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-xs truncate">
                                                        {file.name}
                                                    </span>
                                                </div>
                                            )}

                                            {/* REMOVE FILE */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const dt = new DataTransfer();
                                                    fileArray.forEach((f, i) => {
                                                        if (i !== idx) dt.items.add(f);
                                                    });
                                                    setFiles(dt.files.length ? dt.files : undefined);
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.files = dt.files;
                                                    }
                                                }}
                                                className="
                        absolute top-1 right-1
                        rounded-full bg-black/60 text-white
                        p-0.5 opacity-0 group-hover:opacity-100
                        transition
                      "
                                            >
                                                <FiX className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* TEXTAREA */}
                        <div className="px-4 pt-4 pb-2">
                            <Textarea
                                ref={textareaRef}
                                value={input}
                                placeholder="Type your prompt..."
                                disabled={disabled}
                                rows={1}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                onInput={(e) => {
                                    const el = e.currentTarget;
                                    el.style.height = 'auto';
                                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                                }}
                                className="
                w-full resize-none bg-transparent border-0 outline-none
                text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400
                text-base sm:text-[16px]
                leading-relaxed
                focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0
                [&:focus]:outline-none [&:focus]:ring-0 [&:focus]:border-0
              "
                                style={{
                                    minHeight: '60px',
                                    maxHeight: '140px',
                                    overflowY: 'auto',
                                }}
                            />
                        </div>

                        {/* ACTION ROW */}
                        <div className="flex items-center justify-between px-4 pb-4">
                            {/* LEFT */}
                            <div className="flex items-center gap-1.5">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={(e) =>
                                        e.target.files && setFiles(e.target.files)
                                    }
                                />

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-full cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isPending}
                                >
                                    <FiPlus className="w-4 h-4 text-muted-foreground" />
                                </Button>
                            </div>

                            {/* RIGHT */}
                            <div className="flex items-center gap-1.5">
                                <Button
                                    onClick={handleSend}
                                    disabled={
                                        disabled ||
                                        isPending ||
                                        (!input.trim() && !fileArray.length)
                                    }
                                    className="
                  text-dark dark:text-white
                  h-7 w-7 sm:h-8 sm:w-8
                  rounded-lg p-1.5
                  shadow-lg
                  disabled:opacity-50
                  flex items-center justify-center
                "
                                >
                                    {isPending ? (
                                        <AiOutlineLoading3Quarters className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <FiArrowUp className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
