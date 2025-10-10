interface SpinnerProps {
    className?: string;
    borderClassName?: string;
    size?: number;
}

export default function Spinner({
    className = "",
    borderClassName = "border-atomic-blue-50",
    size = 40,
}: SpinnerProps) {
    return (
        <div
            className={`inline-block animate-spin rounded-full border-2 border-solid border-t-transparent ${borderClassName} ${className}`}
            style={{ width: size, height: size }}
            role="status"
        />
    );
}
