import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { CLOUDINARY_BACKUPS, cldImg, cldSwap } from '../core/media';

/**
 * <img [ssCldSrc]="url">: serves Cloudinary images optimised, and when one
 * fails to load, walks down the backup accounts one at a time (the old
 * _cldImg + _cldImgError). Any other URL is used as is.
 */
@Directive({
  selector: 'img[ssCldSrc]',
  host: { '(error)': 'onError()', loading: 'lazy' },
})
export class CldSrc {
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  readonly ssCldSrc = input<string | null | undefined>(null);
  private tried = 0;

  constructor() {
    effect(() => {
      const url = this.ssCldSrc();
      this.tried = 0;
      if (url) this.img.src = cldImg(url);
      else this.img.removeAttribute('src');
    });
  }

  protected onError(): void {
    while (this.tried < CLOUDINARY_BACKUPS.length) {
      const alt = cldSwap(this.img.src, this.tried++);
      if (alt) { this.img.src = alt; return; }
    }
  }
}
