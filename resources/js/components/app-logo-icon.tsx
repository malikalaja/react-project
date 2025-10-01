import { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="R gradient"
        >
            <defs>
                <linearGradient id="rGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop
                        offset="0"
                        stopColor="currentColor"
                        stopOpacity="0.95"
                    />
                    <stop
                        offset="1"
                        stopColor="currentColor"
                        stopOpacity="0.6"
                    />
                </linearGradient>
            </defs>
            {/* Bowl + stem */}
            <path
                fill="url(#rGrad)"
                d="M6 2h12.2c5.2 0 8.8 3.6 8.8 8.4 0 4.9-3.6 8.6-8.8 8.6H13v8H6V2zm12.1 11.6c2 0 3.5-1.4 3.5-3.2 0-1.9-1.5-3.2-3.5-3.2H13v6.4h5.1z"
            />
            {/* Angular leg */}
            <path fill="currentColor" d="M19.2 17.5 27 30h-7.5l-5.4-8.8h5.1z" />
        </svg>
    );
}
