/**
 * Decorative left-rail SVG motif used by single-pane layouts to preserve the
 * ATLAS transit-line visual identity without introducing runtime dependencies.
 */
import React from 'react'

export default function LeftRailLane() {
  // Pure presentational geometry: no props/state so downstream screens can
  // embed this lane as a stable background element.
  return (
    <div className="absolute -left-[8px] bottom-0 top-[-20px] w-[92px]">
      <svg className="h-full w-full" viewBox="100 0 140 1080" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <line y1="1080" transform="translate(134.5 0.5)" fill="none" stroke="#fccc0a" strokeWidth="8" />
        <line y1="725" transform="translate(172.5 199.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="8" />
        <line y1="410" transform="translate(213.5 239.5)" fill="none" stroke="#0039a5" strokeLinecap="round" strokeWidth="8" />
        <line x2="38" y2="38" transform="translate(134.5 161.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="8" />
        <line x1="38" y1="38" transform="translate(175.5 201.5)" fill="none" stroke="#000aff" strokeLinecap="round" strokeWidth="8" />
        <line x2="38" y2="38" transform="translate(134.5 498.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="8" />
        <line y1="30" x2="38" transform="translate(175.5 649.5)" fill="none" stroke="#0039a6" strokeLinecap="round" strokeWidth="8" />
        <line y1="30" x2="38" transform="translate(134.5 924.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="8" />
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(116 995)" fill="#fdcc09" />
        <text transform="translate(127 1022)" fontSize="26" fontFamily="Helvetica, Arial, sans-serif" fontWeight="700">
          <tspan x="0" y="0">
            1
          </tspan>
        </text>
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(154 850)" fill="#ee352e" />
        <text transform="translate(165 876)" fill="#fff" fontSize="26" fontFamily="Helvetica, Arial, sans-serif" fontWeight="700">
          <tspan x="0" y="0">
            2
          </tspan>
        </text>
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(153 726)" fill="#ee352e" />
        <text transform="translate(165 753)" fill="#fff" fontSize="26" fontFamily="Helvetica, Arial, sans-serif" fontWeight="700">
          <tspan x="0" y="0">
            3
          </tspan>
        </text>
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(195 534)" fill="#0039a5" />
        <text transform="translate(205 561)" fill="#fff" fontSize="26" fontFamily="Helvetica, Arial, sans-serif" fontWeight="700">
          <tspan x="0" y="0">
            4
          </tspan>
        </text>
      </svg>
    </div>
  )
}
