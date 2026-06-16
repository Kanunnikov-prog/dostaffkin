import { Component, inject, signal } from '@angular/core';
import { Header } from '../../header/header';
import { DELIVERY_SIZES, DELIVERY_SPEEDS } from './order.config';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { DeliveryApi } from '../../services/delivery-api';
import { ToastrService } from 'ngx-toastr';

declare var ymaps: any;

@Component({
  selector: 'app-order',
  imports: [Header, UpperCasePipe, ReactiveFormsModule],
  templateUrl: './order.html',
  styleUrl: './order.css',
})
export class Order {
  public readonly sizes = DELIVERY_SIZES;
  public readonly speeds = DELIVERY_SPEEDS;

  toastr = inject(ToastrService);

  public map: any;
  private mapRoute: any;
  private fromPlacemark: any;
  private toPlacemark: any;

  public routeForm: FormGroup;
  public orderForm: FormGroup;

  public orderId: any = signal(null);
  public calculationResult: any = signal(null);
  public isLoading = signal(false);

  constructor(private formBuilder: FormBuilder, private deliveryApi: DeliveryApi) {
    this.routeForm = this.formBuilder.group({
      from: ['', Validators.required],
      to: ['', Validators.required],
      size: ['xs', Validators.required],
      speed: ['regular', Validators.required]
    });
    this.orderForm = this.formBuilder.group({
      name: ['', Validators.required],
      phone: ['', [Validators.required]],
      comment: ['']
    });
  }

  private resetState() {
    this.calculationResult.set(null);
    
    if (this.mapRoute) {
      this.map.geoObjects.remove(this.mapRoute);
      this.mapRoute = null;
    }
    
    if (this.orderId()) {
      this.orderId.set(null);
      this.orderForm.reset();
      this.toastr.info('Состояние сброшено. Выберите новые параметры для расчета.');
    }
  }

  private createPlacemark(address: string, isFrom: boolean = true) {
    if (!this.map || !address || address.trim().length < 3) {
      return;
    }

    ymaps.geocode(address, { kind: 'house' }).then(
      (res: any) => {
        const first = res.geoObjects.get(0);
        if (first) {
          const coords = first.geometry.getCoordinates();
          
          const placemark = new ymaps.Placemark(
            coords,
            {
              iconCaption: isFrom ? 'Отправление' : 'Назначение'
            },
            {
              preset: isFrom ? 'islands#orangeDotIcon' : 'islands#greenDotIcon'
            }
          );

          if (isFrom) {
            if (this.fromPlacemark) {
              this.map.geoObjects.remove(this.fromPlacemark);
            }
            this.fromPlacemark = placemark;
          } else {
            if (this.toPlacemark) {
              this.map.geoObjects.remove(this.toPlacemark);
            }
            this.toPlacemark = placemark;
          }
          this.map.geoObjects.add(placemark);

          this.map.setCenter(coords, 15, {
            duration: 500,
            flying: true
          });
        }
      },
      () => {}
    );
  }

  private updatePlacemarksAddress(from: string, to: string) {
    // Проверяем метку "Откуда"
    const fromContent = this.fromPlacemark?.properties?.get('balloonContent');
    if (fromContent !== 'Отправление: ' + from) {
      if (this.fromPlacemark) {
        this.map.geoObjects.remove(this.fromPlacemark);
        this.fromPlacemark = null;
      }
      ymaps.geocode(from, { kind: 'house' }).then(
        (res: any) => {
          const first = res.geoObjects.get(0);
          if (first) {
            const coords = first.geometry.getCoordinates();
            this.fromPlacemark = new ymaps.Placemark(
              coords,
              {
                iconCaption: 'Отправление',
                balloonContent: 'Отправление: ' + from
              },
              { preset: 'islands#orangeDotIcon' }
            );
            this.map.geoObjects.add(this.fromPlacemark);
          }
        },
        () => {}
      );
    }

    // Проверяем метку "Куда"
    const toContent = this.toPlacemark?.properties?.get('balloonContent');
    if (toContent !== 'Назначение: ' + to) {
      if (this.toPlacemark) {
        this.map.geoObjects.remove(this.toPlacemark);
        this.toPlacemark = null;
      }
      ymaps.geocode(to, { kind: 'house' }).then(
        (res: any) => {
          const first = res.geoObjects.get(0);
          if (first) {
            const coords = first.geometry.getCoordinates();
            this.toPlacemark = new ymaps.Placemark(
              coords,
              {
                iconCaption: 'Назначение',
                balloonContent: 'Назначение: ' + to
              },
              { preset: 'islands#greenDotIcon' }
            );
            this.map.geoObjects.add(this.toPlacemark);
          }
        },
        () => {}
      );
    }
  }

  ngOnInit() {
    ymaps.ready(() => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => (this.init(pos.coords.latitude, pos.coords.longitude)),
          () => this.init());
      } else {
        this.init();
      }
    });
  }

  public init(lat: any = null, lon: any = null) {
    this.map = new ymaps.Map('map', {
      center: [lat ?? 60.030064, lon ?? 30.143349],
      zoom: lat && lon ? 15 : 10,
      controls: ['zoomControl']
    });

    if (lat != null && lon != null) {
      ymaps.geocode([lat, lon], { kind: 'house' }).then(
        (res: any) => {
          const first = res.geoObjects.get(0);
          if (first?.getAddressLine()) {
            const address = first.getAddressLine();
            this.routeForm.controls['from'].setValue(address);
            this.map.geoObjects.add(first);
            
            this.fromPlacemark = new ymaps.Placemark(
              [lat, lon],
              {
                iconCaption: 'Отправление',
                balloonContent: 'Отправление: ' + address
              },
              { preset: 'islands#orangeDotIcon' }
            );
            this.map.geoObjects.add(this.fromPlacemark);
          }
        },
        () => { }
      );
    }

    const fromSuggest = new ymaps.SuggestView('from');
    fromSuggest.events.add('select', (event: any) => {
      const address = event.get('item')?.value ?? '';
      this.routeForm.controls['from'].setValue(address);
      this.createPlacemark(address, true);
      this.resetState();
    });

    const toSuggest = new ymaps.SuggestView('to');
    toSuggest.events.add('select', (event: any) => {
      const address = event.get('item')?.value ?? '';
      this.routeForm.controls['to'].setValue(address);
      this.createPlacemark(address, false);
      this.resetState();
    });

    const fromInput = document.getElementById('from') as HTMLInputElement;
    const toInput = document.getElementById('to') as HTMLInputElement;
    
    fromInput?.addEventListener('input', () => {
      this.resetState();
      if (this.fromPlacemark) {
        this.map.geoObjects.remove(this.fromPlacemark);
        this.fromPlacemark = null;
      }
    });
    
    toInput?.addEventListener('input', () => {
      this.resetState();
      if (this.toPlacemark) {
        this.map.geoObjects.remove(this.toPlacemark);
        this.toPlacemark = null;
      }
    });

    fromInput?.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const address = this.routeForm.get('from')?.value;
        if (address && address.trim().length > 3) {
          this.createPlacemark(address, true);
        }
      }
    });

    toInput?.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const address = this.routeForm.get('to')?.value;
        if (address && address.trim().length > 3) {
          this.createPlacemark(address, false);
        }
      }
    });

    fromInput?.addEventListener('blur', () => {
      const address = this.routeForm.get('from')?.value;
      if (address && address.trim().length > 3) {
        this.createPlacemark(address, true);
      }
    });

    toInput?.addEventListener('blur', () => {
      const address = this.routeForm.get('to')?.value;
      if (address && address.trim().length > 3) {
        this.createPlacemark(address, false);
      }
    });
  }

  public selectSize(size: string) {
    this.routeForm.controls['size'].setValue(size);
    this.resetState();
  }

  public selectSpeed(speed: string) {
    this.routeForm.controls['speed'].setValue(speed);
    this.resetState();
  }

  public calculate() {
    this.resetState();
    this.isLoading.set(true);

    if (!this.map || this.routeForm.invalid) {
      this.isLoading.set(false);
      return;
    }

    const { from, to, size, speed } = this.routeForm.getRawValue();

    if (this.mapRoute) {
      this.map.geoObjects.remove(this.mapRoute);
      this.mapRoute = null;
    }

    this.mapRoute = new ymaps.multiRouter.MultiRoute(
      { referencePoints: [from, to] },
      {
        boundsAutoApply: false,
        wayPointVisible: false,
        viaPointVisible: false
      }
    );
    this.map.geoObjects.add(this.mapRoute);

    this.mapRoute.model.events.add('requestsuccess', () => {
      this.isLoading.set(false);
      try {
        const activeRoute = this.mapRoute.getActiveRoute();
        if (!activeRoute) {
          return this.failedCalculation();
        }

        const km = activeRoute.properties.get('distance').value / 1000;
        const sizeValue = size ?? '';
        const sizeConfig = this.sizes.find((item) => item.value === sizeValue);
        if (!sizeConfig) {
          return this.failedCalculation();
        }
        let total = Math.max(sizeConfig.min, Math.ceil(km * sizeConfig.rate));
        let duration = Math.min(30, 1 + Math.ceil(km / 80));

        if (speed === 'fast') {
          total = Math.ceil(total * 1.15);
          duration = Math.ceil(duration - (duration * 0.30));
        }

        this.calculationResult.set({
          from,
          to,
          size,
          distance: km.toFixed(1),
          duration,
          rate: sizeConfig.rate,
          total,
          speed
        });

        this.updatePlacemarksAddress(from, to);

      } catch (err) {
        this.failedCalculation();
      }
    });

    this.mapRoute.model.events.add('requestfail', () => {
      this.isLoading.set(false);
      this.failedCalculation();
    });
  }

  private failedCalculation() {
    this.calculationResult.set(null);
    this.isLoading.set(false);
    this.toastr.error('Не удалось построить маршрут. Проверьте адреса и выбранные параметры.');
  }

  public submitOrder() {
    const calculation = this.calculationResult();
    if (!calculation) {
      this.toastr.error('Сначала рассчитайте стоимость, чтобы оформить заявку');
      return;
    }

    if (this.orderForm.invalid) {
      this.toastr.error('Введите имя и корректный телефон');
      return;
    }

    const { name, phone, comment } = this.orderForm.getRawValue();
    const trimmedName = (name ?? '').trim();
    const trimmedPhone = (phone ?? '').trim();
    const trimmedComment = (comment ?? '').trim();

    const payload = {
      customer: { name: trimmedName, phone: trimmedPhone, comment: trimmedComment },
      calculation: calculation,
      createdAt: new Date().toISOString()
    };

    this.deliveryApi.createDelivery(payload).subscribe((response) => {
      if ('error' in response) {
        this.toastr.error(response.error);
        return;
      }

      this.toastr.success('Заявка успешно оформлена!');
      this.orderId.set(response.id);
    });
  }
}