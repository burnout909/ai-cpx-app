'use client';

import Image, { StaticImageData } from 'next/image';
import PlayIcon from '@/assets/icon/PlayIcon.svg';
import PauseIcon from '@/assets/icon/PauseIcon.svg';
import { track } from '@/lib/mixpanel';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    isRecording: boolean;
    volume: number;
    onToggleRecording: () => void;
    disabled: boolean;
    patientImage?: string | StaticImageData;
    patientName?: string;
    seconds?: number;
};

export default function FocusModeOverlay({
    isOpen,
    onClose,
    isRecording,
    volume,
    onToggleRecording,
    disabled,
    patientImage,
    patientName,
    seconds,
}: Props) {
    if (!isOpen) return null;

    const showTimeWarning = seconds !== undefined && seconds <= 120 && seconds > 0;

    return (
        <div
            className="fixed inset-0 z-50 flex justify-center animate-focusIn"
        >
        <div className="w-full max-w-[450px] bg-white flex flex-col">
            {/* 중앙 콘텐츠 */}
            <div className="flex-1 flex flex-col items-center justify-center gap-8 pb-[100px]">
                {/* 환자 사진 (live만) */}
                {patientImage && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-[200px] h-[200px] relative">
                            <Image
                                src={patientImage}
                                alt={patientName || '환자'}
                                className="rounded-full object-cover"
                                fill
                                unoptimized={typeof patientImage === 'string'}
                            />
                        </div>
                        {patientName && (
                            <p className="text-[16px] text-gray-600 font-medium">
                                {patientName}
                            </p>
                        )}
                    </div>
                )}

                {/* 종료 2분 전 알림 */}
                {showTimeWarning && (
                    <p className="text-3xl font-bold text-[#7553FC] animate-focusIn">
                        종료 임박 (2분 미만 남음)
                    </p>
                )}

                {/* 볼륨 링 + Play/Pause 버튼 */}
                <div className="relative">
                    {isRecording && (
                        <div
                            className="absolute rounded-full transition-transform duration-100 ease-out"
                            style={{
                                width: '170px',
                                height: '170px',
                                top: '49%',
                                left: '50%',
                                transform: `translate(-50%, -50%) scale(${1 + volume * 1.5})`,
                                opacity: 0.3,
                                background:
                                    'radial-gradient(circle at center, #B1A5E8 0%, #B1A5E8 40%, #BBA6FF 80%, transparent 100%)',
                                boxShadow: `0 0 ${40 + volume * 50}px #B1A5E8`,
                            }}
                        />
                    )}

                    <button
                        type="button"
                        onClick={onToggleRecording}
                        className="outline-none relative cursor-pointer hover:opacity-70 transition-transform duration-150 ease-out active:scale-90"
                        disabled={disabled}
                    >
                        {isRecording ? (
                            <PauseIcon className="w-[180px] h-[180px] text-[#7553FC] opacity-70" />
                        ) : (
                            <PlayIcon className="w-[180px] h-[180px] text-[#7553FC]" />
                        )}
                    </button>
                </div>

                {/* 화면 축소 버튼 */}
                <button
                    type="button"
                    onClick={() => { track("focus_mode", { action: "disable" }); onClose(); }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F3F0FF] hover:bg-[#E9E2FF] transition cursor-pointer"
                    title="화면 축소"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7553FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 14 10 14 10 20" />
                        <polyline points="20 10 14 10 14 4" />
                        <line x1="14" y1="10" x2="21" y2="3" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                </button>
            </div>
        </div>
        </div>
    );
}
