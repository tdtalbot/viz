import * as React from 'react';
import { map } from 'rxjs/operators';

import { GetAvailableApplicationsAndServices } from './models/GetAvailableApplicationsAndServicesRequest';
import { StompClientService } from '@shared/StompClientService';
import { Payload } from './models/Payload';
import { AvailableApplicationsAndServices } from './AvailableApplicationsAndServices';
import { ProgressIndicator } from '@shared/overlay/progress-indicator';

interface Props { }

interface State {
  payload: Payload;
}
export class AvailableApplicationsAndServicesContainer extends React.Component<Props, State> {

  private readonly _stompClientService = StompClientService.getInstance();

  constructor(props: Props) {
    super(props);

    this.state = {
      payload: null
    };

  }
  componentDidMount() {
    this._fetchAvailableApplicationsAndServices();
  }

  private _fetchAvailableApplicationsAndServices() {
    const getApplicationsAndServices = new GetAvailableApplicationsAndServices();
    this._subscribeForApplicationAndServicesResponse(getApplicationsAndServices.replyTo);
    this._stompClientService.send({
      destination: getApplicationsAndServices.url,
      replyTo: getApplicationsAndServices.replyTo,
      body: JSON.stringify(getApplicationsAndServices.requestBody)
    });
  }

  private _subscribeForApplicationAndServicesResponse(destination: string) {
    this._stompClientService.readOnceFrom(destination)
      .pipe(map(JSON.parse as (body: string) => Payload))
      .subscribe({
        next: payload => {
          this.setState({
            payload
          });
        }
      });
  }

  render() {
    if (!this.state.payload) {
      return (
        <ProgressIndicator show />
      );
    }
    return (
      <AvailableApplicationsAndServices payload={this.state.payload} />
    );
  }

}