'use client';
import { ReactNode, useEffect, useState } from 'react';
import CloseIcon from '@/assets/icon/CloseIcon.svg';

export default function ReportModal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 모달 열릴 때 슬라이드 업
    const timeout = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timeout);
  }, []);

  const handleClose = () => {
    // 슬라이드 다운 후 닫기
    setIsVisible(false);
    setTimeout(onClose, 300); // transition 시간과 동일
  };

  return (
    <>
      {/* dimmed background */}
      <div
        className={`fixed inset-0 z-[40] bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        } max-w-[450px] mx-auto`}
        onClick={handleClose}
      />

      {/* bottom sheet modal */}
      <div
        className={`fixed bottom-0 left-1/2 z-[50] w-full max-w-[450px] -translate-x-1/2 bg-[#FCFCFC] rounded-t-2xl shadow-lg overflow-y-auto pb-[220px] transform transition-transform duration-300 ${
          isVisible ? 'translate-y-20' : 'translate-y-full'
        } h-[90vh]`}
      >
        {/* top bar */}
        <div className="flex justify-end items-center h-[56px] px-4">
          <button
            onClick={handleClose}
            className="w-[40px] h-[40px] flex justify-center items-center rounded-full transition hover:bg-gray-100"
          >
            <CloseIcon
              width={20}
              height={20}
              className="text-gray-500 hover:text-gray-400"
            />
          </button>
        </div>

        {/* modal content */}
        <div className="px-4">{children}</div>
      </div>
    </>
  );
}
