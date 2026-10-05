export function ZoomMeetingLayoutStyles() {
  return (
    <style>{`
      .zoom-meeting-shell {
        --zoom-meeting-gutter: 1rem;
      }

      .zoom-meeting-gutter-position {
        left: var(--zoom-meeting-gutter);
        right: var(--zoom-meeting-gutter);
      }

      .zoom-meeting-header {
        top: 1.25rem;
      }

      .zoom-meeting-gutter-padding {
        padding-left: var(--zoom-meeting-gutter);
        padding-right: var(--zoom-meeting-gutter);
      }

      .zoom-participant-gallery {
        top: 5rem;
        bottom: 6rem;
      }

      .zoom-toolbar-secondary {
        display: none !important;
      }

      .zoom-toolbar-side-actions {
        top: -3.5rem;
      }

      .zoom-toolbar-more {
        display: inline-flex !important;
        order: 5;
      }

      .zoom-toolbar-hand {
        order: 4;
      }

      .zoom-toolbar-leave {
        order: 6;
      }

      @media (min-width: 640px) {
        .zoom-toolbar-side-actions {
          top: 0;
        }

        .zoom-meeting-shell {
          --zoom-meeting-gutter: 1.5rem;
        }

        .zoom-meeting-header {
          top: 1.75rem;
        }

        .zoom-participant-gallery {
          top: 6rem;
          bottom: 7rem;
        }

        .zoom-toolbar-people,
        .zoom-toolbar-chat {
          display: inline-flex !important;
        }

      }

      @media (min-width: 768px) {
        .zoom-meeting-panel[data-side='right'] {
          top: 6rem !important;
          right: 1.5rem !important;
          bottom: 6rem !important;
          height: auto !important;
          width: 22rem !important;
          max-width: none !important;
        }

        .zoom-gallery-sidebar {
          padding-right: calc(var(--zoom-meeting-gutter) + 23rem);
        }

        .zoom-share-stage-panel {
          right: calc(var(--zoom-meeting-gutter) + 23rem);
          bottom: 16rem;
        }

        .zoom-filmstrip-panel {
          left: var(--zoom-meeting-gutter);
          right: calc(var(--zoom-meeting-gutter) + 23rem);
          top: auto;
          bottom: 7rem;
          width: auto;
          height: 8rem;
          flex-direction: row;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .zoom-filmstrip-panel .zoom-video-tile-filmstrip {
          width: 12rem;
          height: 100%;
          flex: 0 0 auto;
        }
      }

      @media (min-width: 1024px) {
        .zoom-meeting-panel[data-side='right'] {
          right: clamp(2rem, 9vw, 10.5rem) !important;
          width: 32rem !important;
        }

        .zoom-meeting-shell {
          --zoom-meeting-gutter: clamp(4rem, 9vw, 10.5rem);
        }

        .zoom-meeting-header {
          top: 2.25rem;
        }

        .zoom-share-stage {
          left: var(--zoom-meeting-gutter);
          right: calc(var(--zoom-meeting-gutter) + 14.75rem);
        }

        .zoom-participant-gallery {
          bottom: 8rem;
        }

        .zoom-share-stage-panel {
          right: calc(var(--zoom-meeting-gutter) + 33rem);
          bottom: 18rem;
        }

        .zoom-filmstrip {
          right: var(--zoom-meeting-gutter);
        }

        .zoom-filmstrip-panel {
          left: var(--zoom-meeting-gutter);
          right: calc(var(--zoom-meeting-gutter) + 33rem);
          top: auto;
          bottom: 8rem;
          width: auto;
          height: 8.5rem;
          flex-direction: row;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .zoom-filmstrip-panel .zoom-video-tile-filmstrip {
          width: clamp(9rem, 15vw, 14rem);
          height: 100%;
          flex: 0 0 auto;
        }

        .zoom-gallery-sidebar {
          padding-right: calc(var(--zoom-meeting-gutter) + 33rem);
        }
      }

      @media (max-width: 767px) {
        .zoom-toolbar-meta,
        .zoom-toolbar-divider {
          display: none !important;
        }
      }

      @keyframes float-reaction {
        0% {
          transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(0.3);
          opacity: 0;
          animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        12% {
          transform: translate(-50%, -50%) translate(calc(var(--dx) * 0.08), -6px)
            rotate(calc(var(--rot) * 0.08)) scale(1.1);
          opacity: 1;
          animation-timing-function: ease-out;
        }
        100% {
          transform: translate(-50%, -50%) translate(var(--dx), -340px) rotate(var(--rot))
            scale(0.95);
          opacity: 0;
        }
      }

      @keyframes icon-pop {
        0% { transform: scale(0.55); }
        60% { transform: scale(1.18); }
        100% { transform: scale(1); }
      }
    `}</style>
  );
}
