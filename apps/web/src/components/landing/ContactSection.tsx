import React from 'react';
import { cn } from '@/lib/utils';
import {
  Check,
  Copy,
  LucideIcon,
  Mail,
  MapPin,
  Phone,
  Github,
  Twitter,
  Linkedin,
  Instagram,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const APP_EMAIL = 'info@watchsphere.io';
const APP_PHONE = '+1 (555) 123-4567';

export function ContactSection() {
  const socialLinks = [
    {
      icon: Github,
      href: '#',
      label: 'GitHub',
    },
    {
      icon: Twitter,
      href: '#',
      label: 'Twitter',
    },
    {
      icon: Linkedin,
      href: '#',
      label: 'LinkedIn',
    },
    {
      icon: Instagram,
      href: '#',
      label: 'Instagram',
    },
  ];

  return (
    <section id="contact" className="bg-white">
      <div className="mx-auto max-w-6xl border-x border-gray-200">
        <div
          aria-hidden
          className="absolute inset-0 isolate -z-10 opacity-80 contain-strict pointer-events-none"
        >
          <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,rgba(0,0,0,0.06)_0,rgba(0,0,0,0.02)_50%,rgba(0,0,0,0.01)_80%)] absolute top-0 left-0 h-80 w-36 -translate-y-20 -rotate-45 rounded-full" />
        </div>
        <div className="flex grow flex-col justify-center px-4 md:px-6 pt-20 pb-8">
          <h2 className="text-4xl font-bold md:text-5xl text-gray-900">
            Contact Us
          </h2>
          <p className="text-gray-600 mb-5 text-base">
            Get in touch with the WatchSphere team.
          </p>
        </div>
        <div className="border-t border-gray-200" />
        <div className="grid md:grid-cols-3">
          <Box
            icon={Mail}
            title="Email"
            description="We respond to all emails within 24 hours."
          >
            <a
              href={`mailto:${APP_EMAIL}`}
              className="font-mono text-base font-medium tracking-wide hover:underline"
            >
              {APP_EMAIL}
            </a>
            <CopyButton className="size-6" text={APP_EMAIL} />
          </Box>
          <Box
            icon={MapPin}
            title="Headquarters"
            description="Visit us in New York City."
          >
            <span className="font-mono text-base font-medium tracking-wide">
              123 Watch Street, Suite 100
              <br />
              New York, NY 10001
            </span>
          </Box>
          <Box
            icon={Phone}
            title="Phone"
            description="Monday to Friday, 9am-6pm EST."
            className="border-b-0 md:border-r-0"
          >
            <div>
              <div className="flex items-center gap-x-2">
                <a
                  href={`tel:${APP_PHONE}`}
                  className="block font-mono text-base font-medium tracking-wide hover:underline"
                >
                  {APP_PHONE}
                </a>
                <CopyButton className="size-6" text={APP_PHONE} />
              </div>
            </div>
          </Box>
        </div>
        <div className="border-t border-gray-200" />
        <div className="relative flex h-full min-h-[320px] items-center justify-center">
          <div
            className={cn(
              'z-[-1] absolute inset-0 size-full',
              'bg-[radial-gradient(rgba(0,0,0,0.15)_1px,transparent_1px)]',
              'bg-[size:32px_32px]',
              '[mask-image:radial-gradient(ellipse_at_center,white_30%,transparent)]'
            )}
          />

          <div className="relative z-10 space-y-6">
            <h3 className="text-center text-3xl font-bold md:text-4xl text-gray-900">
              Find us online
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-100/50 hover:bg-gray-200 flex items-center gap-x-2 rounded-full border border-gray-200 px-4 py-2 transition-colors"
                >
                  <link.icon className="size-4" />
                  <span className="font-mono text-sm font-medium tracking-wide">
                    {link.label}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type ContactBox = React.ComponentProps<'div'> & {
  icon: LucideIcon;
  title: string;
  description: string;
};

function Box({
  icon: Icon,
  title,
  description,
  className,
  children,
}: ContactBox) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between border-b border-gray-200 md:border-r md:border-b-0',
        className
      )}
    >
      <div className="bg-gray-50 flex items-center gap-x-3 border-b border-gray-200 p-4">
        <Icon className="text-gray-500 size-5" strokeWidth={1} />
        <h3 className="text-lg font-medium tracking-wider text-gray-900">
          {title}
        </h3>
      </div>
      <div className="flex items-center gap-x-2 p-4 py-12">{children}</div>
      <div className="border-t border-gray-200 p-4">
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </div>
  );
}

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
}

function CopyButton({ className, text, ...props }: CopyButtonProps) {
  const [copied, setCopied] = React.useState<boolean>(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('disabled:opacity-100', className)}
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      disabled={copied || props.disabled}
      {...props}
    >
      <div
        className={cn(
          'transition-all',
          copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        )}
      >
        <Check className="size-3.5 stroke-emerald-500" aria-hidden="true" />
      </div>
      <div
        className={cn(
          'absolute transition-all',
          copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        )}
      >
        <Copy aria-hidden="true" className="size-3.5" />
      </div>
    </Button>
  );
}
