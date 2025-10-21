import { ReactNode } from 'react';
import CloseIcon from '@/assets/icon/CloseIcon.svg';

export default function ReportModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
    return (
        <>
            <div className='fixed top-0 w-full max-w-[450px] mx-auto flex h-[100px] items-center bg-[#FCFCFC] z-[10]'>
                <div className='flex pr-4 justify-end w-full items-center'>
                    <button
                        onClick={onClose}
                        className="w-[40px] h-[40px] flex justify-end items-center rounded-full transition cursor-pointer"
                    >
                        <CloseIcon width={20} height={20} className="text-gray-500 hover:text-gray-400" />
                    </button>
                </div>

            </div>
            <div className="fixed inset-0 z-[48] w-full max-w-[450px] min-h-[100vh] overflow-y-auto py-4 relative space-y-2 bg-[#FCFCFC]">
                {children}
            </div></>
    );
}
