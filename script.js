'use strict';

const form = document.querySelector('.form');
const listWorkouts = document.querySelector('.list-workouts');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const resetBtn = document.querySelector('.reset-btn');
const deleteAllBtn = document.querySelector('.delete-all-btn');
const sortWorkouts = document.querySelector('.sort-workouts');

class Workout {
  id = Date.now() + ''.slice(-10);
  clicks = 0;

  constructor(coords, distance, duration, date = new Date()) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this.date = date;
  }

  _setDescription() {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const workoutDate = this.date;
    this.description = `<strong>${this.type[0].toUpperCase()}${this.type.slice(
      1
    )}</strong> on <strong>${
      months[workoutDate.getMonth()]
    } ${workoutDate.getDate()}</strong> at <strong>${String(
      workoutDate.getHours()
    ).padStart(2, '0')}:${String(workoutDate.getMinutes()).padStart(
      2,
      '0'
    )}</strong>`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence, date) {
    super(coords, distance, duration, date);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain, date) {
    super(coords, distance, duration, date);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.duration / (this.distance / 60);
    return this.speed;
  }
}

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #editingWorkout = null;
  #markers = new Map();
  #currentSort = 'date';

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    this._attachEventHandlers();
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
        this._showPopup(
          'Error',
          'Could not get your position. Please enable location services.'
        )
      );
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));
    this.#workouts.forEach(work => this._renderWorkoutMarker(work));
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationForm() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  async _createWorkout(
    type,
    coords,
    distance,
    duration,
    extra,
    date = new Date()
  ) {
    try {
      const isValid = await this._validateInputs(distance, duration, extra);
      if (!isValid) return null;

      if (type === 'running')
        return new Running(coords, distance, duration, extra, date);
      if (type === 'cycling')
        return new Cycling(coords, distance, duration, extra, date);

      await this._showPopup('Error', 'Invalid workout type');
      return null;
    } catch (err) {
      await this._showPopup('Error', err.message);
      return null;
    }
  }

  _updateMarkers(workout, oldWorkout = null) {
    if (oldWorkout) {
      const oldMarker = this.#markers.get(oldWorkout.id);
      if (oldMarker) {
        oldMarker.remove();
        this.#markers.delete(oldWorkout.id);
      }
    }

    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.set(workout.id, marker);
  }

  async _newWorkout(e) {
    e.preventDefault();
    if (this.#editingWorkout) {
      await this._updateWorkout(e);
      return;
    }

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const extra =
      type === 'running' ? +inputCadence.value : +inputElevation.value;

    if (!this.#mapEvent) {
      await this._showPopup('Error', 'Please click on the map first');
      return;
    }

    const { lat, lng } = this.#mapEvent.latlng;
    const workout = await this._createWorkout(
      type,
      [lat, lng],
      distance,
      duration,
      extra
    );

    if (!workout) return;

    this.#workouts.push(workout);
    this._updateMarkers(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._setLocalStorage();

    if (this.#workouts.length >= 2) {
      document.querySelector('.sort-workouts').classList.remove('hidden');
    }
  }

  async _updateWorkout(e) {
    e.preventDefault();
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const extra =
      type === 'running' ? +inputCadence.value : +inputElevation.value;
    const oldWorkout = this.#editingWorkout;

    const workout = await this._createWorkout(
      type,
      oldWorkout.coords,
      distance,
      duration,
      extra,
      oldWorkout.date
    );

    if (!workout) return;

    workout.id = oldWorkout.id;
    workout.date = oldWorkout.date;

    const index = this.#workouts.findIndex(w => w.id === workout.id);
    this.#workouts[index] = workout;

    this._updateMarkers(workout, oldWorkout);
    this._updateWorkoutUI(workout);
    this._hideForm();

    document
      .querySelector('.workout--editing')
      ?.classList.remove('workout--editing');

    this.#editingWorkout = null;
    this._setLocalStorage();
  }

  _updateWorkoutUI(workout) {
    const workoutEl = document.querySelector(`[data-id="${workout.id}"]`);
    if (workoutEl) workoutEl.remove();
    this._renderWorkout(workout);
  }

  async _validateInputs(...inputs) {
    const isValid = inputs.every(inp => Number.isFinite(inp) && inp > 0);
    if (!isValid) {
      await this._showPopup(
        'Invalid Input',
        'Please enter valid positive numbers for all fields'
      );
      return false;
    }
    return true;
  }

  _handleWorkoutClick(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    if (e.target.classList.contains('workout__edit')) {
      this._editWorkout(workoutEl);
      return;
    }

    if (e.target.classList.contains('workout__delete')) {
      this._deleteWorkout(workoutEl);
      return;
    }

    this._moveToPopup(e);
  }

  _deleteWorkout(workoutEl) {
    const workoutId = workoutEl.dataset.id;
    this.#workouts = this.#workouts.filter(w => w.id !== workoutId);

    const marker = this.#markers.get(workoutId);
    if (marker) {
      marker.remove();
      this.#markers.delete(workoutId);
    }

    workoutEl.remove();
    this._setLocalStorage();

    if (this.#workouts.length < 2) {
      document.querySelector('.sort-workouts').classList.add('hidden');
    }
  }

  _editWorkout(workoutEl) {
    const workout = this.#workouts.find(w => w.id === workoutEl.dataset.id);
    this.#editingWorkout = workout;

    form.classList.remove('hidden');
    workoutEl.classList.add('workout--editing');

    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (workout.type === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.value = workout.cadence;
    }
    if (workout.type === 'cycling') {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputElevation.value = workout.elevationGain;
    }
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.set(workout.id, marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">
          ${workout.description}
          <div class="workout__controls">
            <button class="workout__edit" title="Edit">✏️</button>
            <button class="workout__delete" title="Delete">🗑️</button>
          </div>
        </h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>`;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;
    }
    listWorkouts.insertAdjacentHTML('beforeend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data.map(work => {
      const date = new Date(work.date);
      let workout;

      if (work.type === 'running') {
        workout = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence,
          date
        );
      }
      if (work.type === 'cycling') {
        workout = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevationGain,
          date
        );
      }

      workout.id = work.id;
      workout.clicks = work.clicks || 0;
      return workout;
    });

    this.#workouts.forEach(work => this._renderWorkout(work));
    if (this.#currentSort !== 'date') {
      this._sortWorkouts({ target: { value: this.#currentSort } });
    }

    if (this.#workouts.length >= 2) {
      document.querySelector('.sort-workouts').classList.remove('hidden');
    }
  }

  reset = () => {
    localStorage.removeItem('workouts');
    this.#markers.forEach(marker => marker.remove());
    this.#markers.clear();
    this.#workouts = [];
    document.querySelector('.sort-workouts').classList.add('hidden');
    location.reload();
  };

  async _deleteAllWorkouts() {
    const confirmed = await this._showPopup(
      'Delete All Workouts',
      'Are you sure you want to delete all workouts? This action cannot be undone.',
      true
    );

    if (!confirmed) return;

    this.#markers.forEach(marker => marker.remove());
    this.#markers.clear();
    this.#workouts = [];
    document.querySelectorAll('.workout').forEach(workout => workout.remove());
    this._setLocalStorage();
    document.querySelector('.sort-workouts').classList.add('hidden');
  }

  _sortWorkouts(e) {
    const sortBy = e.target.value;
    this.#currentSort = sortBy;

    this.#workouts.sort((a, b) => {
      const [field, order] = sortBy.split('-');
      const multiplier = order === 'desc' ? 1 : -1;

      switch (field) {
        case 'date':
          return multiplier * (a.date - b.date);
        case 'distance':
          return multiplier * (a.distance - b.distance);
        default:
          return 0;
      }
    });

    document.querySelectorAll('.workout').forEach(workout => workout.remove());
    this.#workouts.forEach(workout => this._renderWorkout(workout));
  }

  _showPopup(title, message, isConfirm = false) {
    const existingOverlay = document.querySelector('.popup-overlay');
    if (existingOverlay) {
      document.body.removeChild(existingOverlay);
    }

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'popup-overlay';

      const popup = document.createElement('div');
      popup.className = 'popup';

      popup.addEventListener('click', e => {
        e.stopPropagation();
      });

      popup.innerHTML = `
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="popup-buttons">
          <button class="popup-button popup-button--confirm">${
            isConfirm ? 'Yes' : 'OK'
          }</button>
          ${
            isConfirm
              ? '<button class="popup-button popup-button--cancel">Cancel</button>'
              : ''
          }
        </div>
      `;

      overlay.appendChild(popup);
      document.body.appendChild(overlay);

      const confirmBtn = popup.querySelector('.popup-button--confirm');
      const cancelBtn = popup.querySelector('.popup-button--cancel');

      const cleanup = () => {
        document.body.removeChild(overlay);
      };

      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          cleanup();
          resolve(false);
        });
      }
    });
  }

  _attachEventHandlers() {
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationForm);
    containerWorkouts.addEventListener(
      'click',
      this._handleWorkoutClick.bind(this)
    );
    resetBtn.addEventListener('click', this.reset);
    deleteAllBtn.addEventListener('click', this._deleteAllWorkouts.bind(this));
    sortWorkouts.addEventListener('change', this._sortWorkouts.bind(this));

    // Add close button event listener
    document.querySelector('.form__close').addEventListener('click', e => {
      e.preventDefault();
      this._hideForm();
      if (this.#editingWorkout) {
        document
          .querySelector('.workout--editing')
          ?.classList.remove('workout--editing');
        this.#editingWorkout = null;
      }
    });
  }
}

const app = new App();
