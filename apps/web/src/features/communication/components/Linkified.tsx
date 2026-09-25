import { Fragment } from 'react';

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g;

/** Matndagi http/https havolalarini bosiladigan qiladi (boshqa protokollar havola bo‘lmaydi). */
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((chunk, index) =>
        index % 2 === 1 ? (
          <a key={index} href={chunk} target="_blank" rel="noopener noreferrer nofollow">
            {chunk}
          </a>
        ) : (
          <Fragment key={index}>{chunk}</Fragment>
        ),
      )}
    </>
  );
}
