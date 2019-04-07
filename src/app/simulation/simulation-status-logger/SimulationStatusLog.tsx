import * as React from 'react';

import { SimulationStatusLogMessage } from './SimulationStatusLogMessage';
import { Wait } from '@shared/wait';

import './SimulationStatusLog.scss';

interface Props {
  messages: string[];
  isFetching: boolean;
  simulationRunning: boolean;
}

interface State {
  dragHandlePosition: number;
}

export class SimulationStatusLog extends React.Component<Props, State> {

  private _messagesContainer: HTMLElement = null;
  private readonly _dragHandleMinPosition = 85;
  private readonly _dragHandleMaxPosition = document.body.clientHeight - 71;
  private readonly _logLevelAndColorTupleList = [
    ['FATAL', '#B71C1C'],
    ['ERROR', '#D32F2F'],
    ['WARN', '#FFFF00'],
    ['INFO', '#F0F4C3'],
    ['DEBUG', '#E1F5FE'],
    ['TRACE', '#C0CA33']
  ];

  constructor(props: any) {
    super(props);
    this.state = {
      dragHandlePosition: this._dragHandleMaxPosition
    };
    this._mouseDown = this._mouseDown.bind(this);
    this._mouseUp = this._mouseUp.bind(this);
    this._resize = this._resize.bind(this);
  }

  componentWillReceiveProps(newProps: Props) {
    if (newProps !== this.props && newProps.simulationRunning)
      this.setState({ dragHandlePosition: 430 });
  }

  render() {

    return (
      <div
        className='simulation-status-logger'
        style={{
          top: `${this.state.dragHandlePosition}px`
        }}>
        <header className='simulation-status-logger__header'>
          <span className='simulation-status-logger__header__label'>Simulation Status</span>
          <div className='simulation-status-logger__header__legends'>
            {
              this._logLevelAndColorTupleList.map((tuple, i) => (
                <div key={i} className='simulation-status-logger__header__legends__level'>
                  <span
                    className='simulation-status-logger__header__legends__level__color'
                    style={{ backgroundColor: tuple[1] }} />
                  <span className='simulation-status-logger__header__legends__level__label'>{tuple[0]}</span>
                </div>
              ))
            }
          </div>
        </header>
        <div className='simulation-status-logger__drag-handle' onMouseDown={this._mouseDown} />
        <section className='simulation-status-logger__content' ref={elem => this._messagesContainer = elem}>
          {
            this.props.messages.map(message => {
              return <SimulationStatusLogMessage key={message} message={message} />;
            })
          }
        </section>
        <Wait show={this.props.isFetching} />
      </div>
    );
  }

  private _mouseDown() {
    this._messagesContainer.style.userSelect = 'none';
    document.documentElement.addEventListener('mousemove', this._resize, false);
    document.documentElement.addEventListener('mouseup', this._mouseUp, false);
  }

  private _mouseUp() {
    this._messagesContainer.style.userSelect = 'initial';
    window.getSelection().empty();
    document.documentElement.removeEventListener('mousemove', this._resize, false);
    document.documentElement.removeEventListener('mouseup', this._mouseUp, false);
  }

  private _resize(event) {
    const newPosition = Math.min(this._dragHandleMaxPosition, Math.max(event.clientY - 71, this._dragHandleMinPosition));
    this.setState({
      dragHandlePosition: newPosition
    });
  }
}