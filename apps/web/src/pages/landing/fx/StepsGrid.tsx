import type { LucideIcon } from 'lucide-react';
import { tiltHandlers } from './interactions';

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** Barcha qadamlar bir ko‘rinishda: katta ekranda 4 ustun, o‘rtada 2 ustun, telefonda 1 ustun. */
export function StepsGrid({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <section className="gm-steps4" id="qanday">
      <h2 data-reveal>{title}</h2>
      <ol className="gm-steps4__grid">
        {steps.map((step, index) => (
          <li key={step.title} className="gm-steps4__card gm-tilt" {...tiltHandlers} data-reveal style={{ ['--i' as string]: index }}>
            <span className="gm-steps4__num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="gm-steps4__icon">
              <step.icon size={26} strokeWidth={1.9} />
            </span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {index < steps.length - 1 && <i className="gm-steps4__arrow" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </section>
  );
}
