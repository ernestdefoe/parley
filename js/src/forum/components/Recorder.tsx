import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import extractText from 'flarum/common/utils/extractText';
import Icons from '../icons';
import { duration } from '../labels';

const t = (key: string, params: Record<string, unknown> = {}) => app.translator.trans('ernestdefoe-parley.forum.window.' + key, params);

/**
 * Recording a voice note, in place of the message box: a red dot and the
 * time, Cancel, and Send. It stops itself at the forum's length limit.
 * Loaded the first time the microphone is pressed.
 *
 * Opus in WebM where the browser makes it (Chrome, Firefox, Edge), AAC in
 * MP4 where it does not (Safari). The server reads the bytes either way.
 */
export interface RecorderAttrs extends ComponentAttrs {
  /** The forum's length limit, in seconds. */
  max: number;
  /** Called once: the recording (or null when cancelled or too short) and its length. */
  ondone: (blob: Blob | null, seconds?: number) => void;
}

export default class Recorder extends Component<RecorderAttrs> {
  seconds = 0;
  ready = false;
  stream?: MediaStream;
  rec?: MediaRecorder;
  chunks?: Blob[];
  began?: number;
  timer?: ReturnType<typeof setInterval>;
  send?: boolean;

  oninit(vnode: Mithril.Vnode<RecorderAttrs, this>) {
    super.oninit(vnode);
    this.seconds = 0;
    this.ready = false;
    this.start();
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      app.alerts.show({ type: 'error' }, t('mic_denied'));
      this.attrs.ondone(null);
      m.redraw();
      return;
    }

    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((x) => MediaRecorder.isTypeSupported?.(x));
    const rec = new MediaRecorder(this.stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
    const chunks: Blob[] = [];
    this.rec = rec;
    this.chunks = chunks;
    rec.ondataavailable = (e: BlobEvent) => e.data.size && chunks.push(e.data);
    rec.onstop = () => this.finish();
    rec.start(1000);
    const began = Date.now();
    this.began = began;
    this.ready = true;
    this.timer = setInterval(() => {
      this.seconds = (Date.now() - began) / 1000;
      if (this.seconds >= this.attrs.max) this.stop(true);
      m.redraw();
    }, 250);
    m.redraw();
  }

  stop(send: boolean) {
    this.send = send;
    clearInterval(this.timer);
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    else this.finish();
  }

  finish() {
    this.stream?.getTracks().forEach((track) => track.stop());
    const seconds = Math.min(this.attrs.max, (Date.now() - (this.began || Date.now())) / 1000);
    const blob = this.send && this.chunks?.length && seconds >= 0.5 ? new Blob(this.chunks, { type: this.rec!.mimeType }) : null;
    this.attrs.ondone(blob, seconds);
    m.redraw();
  }

  onremove(vnode: Mithril.VnodeDOM<RecorderAttrs, this>) {
    super.onremove(vnode);
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop());
  }

  view() {
    return (
      <div className="pl-recorder" role="group" aria-label={extractText(t('recording'))}>
        <button
          type="button"
          className="pl-ib"
          aria-label={extractText(t('cancel'))}
          title={extractText(t('cancel'))}
          onclick={() => this.stop(false)}
        >
          {Icons.trash()}
        </button>
        <span className={'pl-rec-dot' + (this.ready ? ' on' : '')} />
        <span className="pl-rec-time">
          {duration(this.seconds)} / {duration(this.attrs.max)}
        </span>
        <button
          type="button"
          className="pl-ib pl-send"
          aria-label={extractText(t('send_voice'))}
          title={extractText(t('send_voice'))}
          disabled={!this.ready}
          onclick={() => this.stop(true)}
        >
          {Icons.send()}
        </button>
      </div>
    );
  }
}
