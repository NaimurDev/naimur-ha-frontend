import "@material/mwc-button/mwc-button";
import "@material/mwc-linear-progress/mwc-linear-progress";
import { css, CSSResultGroup, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { BINARY_STATE_OFF } from "../../../common/const";
import { supportsFeature } from "../../../common/entity/supports-feature";
import "../../../components/ha-alert";
import "../../../components/ha-checkbox";
import "../../../components/ha-circular-progress";
import "../../../components/ha-faded";
import "../../../components/ha-formfield";
import "../../../components/ha-markdown";
import { isUnavailableState } from "../../../data/entity";
import {
  UpdateEntity,
  UpdateEntityFeature,
  updateIsInstalling,
  updateReleaseNotes,
} from "../../../data/update";
import type { HomeAssistant } from "../../../types";
import { showAlertDialog } from "../../generic/show-dialog-box";

@customElement("more-info-update")
class MoreInfoUpdate extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public stateObj?: UpdateEntity;

  @state() private _releaseNotes?: string | null;

  @state() private _error?: string;

  protected render() {
    if (
      !this.hass ||
      !this.stateObj ||
      isUnavailableState(this.stateObj.state)
    ) {
      return nothing;
    }

    const skippedVersion =
      this.stateObj.attributes.latest_version &&
      this.stateObj.attributes.skipped_version ===
        this.stateObj.attributes.latest_version;

    return html`
      ${this.stateObj.attributes.in_progress
        ? supportsFeature(this.stateObj, UpdateEntityFeature.PROGRESS) &&
          this.stateObj.attributes.update_percentage !== null
          ? html`<mwc-linear-progress
              .progress=${this.stateObj.attributes.update_percentage / 100}
              buffer=""
            ></mwc-linear-progress>`
          : html`<mwc-linear-progress indeterminate></mwc-linear-progress>`
        : ""}
      <h3>${this.stateObj.attributes.title}</h3>
      ${this._error
        ? html`<ha-alert alert-type="error">${this._error}</ha-alert>`
        : ""}
      <div class="row">
        <div class="key">
          ${this.hass.formatEntityAttributeName(
            this.stateObj,
            "installed_version"
          )}
        </div>
        <div class="value">
          ${this.stateObj.attributes.installed_version ??
          this.hass.localize("state.default.unavailable")}
        </div>
      </div>
      <div class="row">
        <div class="key">
          ${this.hass.formatEntityAttributeName(
            this.stateObj,
            "latest_version"
          )}
        </div>
        <div class="value">
          ${this.stateObj.attributes.latest_version ??
          this.hass.localize("state.default.unavailable")}
        </div>
      </div>

      ${this.stateObj.attributes.release_url
        ? html`<div class="row">
            <div class="key">
              <a
                href=${this.stateObj.attributes.release_url}
                target="_blank"
                rel="noreferrer"
              >
                ${this.hass.localize(
                  "ui.dialogs.more_info_control.update.release_announcement"
                )}
              </a>
            </div>
          </div>`
        : ""}
      ${supportsFeature(this.stateObj!, UpdateEntityFeature.RELEASE_NOTES) &&
      !this._error
        ? this._releaseNotes === undefined
          ? html`<div class="flex center">
              <ha-circular-progress indeterminate></ha-circular-progress>
            </div>`
          : html`<hr />
              <ha-faded>
                <ha-markdown .content=${this._releaseNotes}></ha-markdown>
              </ha-faded> `
        : this.stateObj.attributes.release_summary
          ? html`<hr />
              <ha-markdown
                .content=${this.stateObj.attributes.release_summary}
              ></ha-markdown>`
          : ""}
      ${supportsFeature(this.stateObj, UpdateEntityFeature.BACKUP)
        ? html`<hr />
            <ha-formfield
              .label=${this.hass.localize(
                "ui.dialogs.more_info_control.update.create_backup"
              )}
            >
              <ha-checkbox
                checked
                .disabled=${updateIsInstalling(this.stateObj)}
              ></ha-checkbox>
            </ha-formfield> `
        : ""}
      <div class="actions">
        ${this.stateObj.state === BINARY_STATE_OFF &&
        this.stateObj.attributes.skipped_version
          ? html`
              <mwc-button @click=${this._handleClearSkipped}>
                ${this.hass.localize(
                  "ui.dialogs.more_info_control.update.clear_skipped"
                )}
              </mwc-button>
            `
          : html`
              <mwc-button
                @click=${this._handleSkip}
                .disabled=${skippedVersion ||
                this.stateObj.state === BINARY_STATE_OFF ||
                updateIsInstalling(this.stateObj)}
              >
                ${this.hass.localize(
                  "ui.dialogs.more_info_control.update.skip"
                )}
              </mwc-button>
            `}
        ${supportsFeature(this.stateObj, UpdateEntityFeature.INSTALL)
          ? html`
              <mwc-button
                @click=${this._handleInstall}
                .disabled=${(this.stateObj.state === BINARY_STATE_OFF &&
                  !skippedVersion) ||
                updateIsInstalling(this.stateObj)}
              >
                ${this.hass.localize(
                  "ui.dialogs.more_info_control.update.install"
                )}
              </mwc-button>
            `
          : ""}
      </div>
    `;
  }

  protected firstUpdated(): void {
    if (supportsFeature(this.stateObj!, UpdateEntityFeature.RELEASE_NOTES)) {
      updateReleaseNotes(this.hass, this.stateObj!.entity_id)
        .then((result) => {
          this._releaseNotes = result;
        })
        .catch((err) => {
          this._error = err.message;
        });
    }
  }

  get _shouldCreateBackup(): boolean | null {
    if (!supportsFeature(this.stateObj!, UpdateEntityFeature.BACKUP)) {
      return null;
    }
    const checkbox = this.shadowRoot?.querySelector("ha-checkbox");
    if (checkbox) {
      return checkbox.checked;
    }
    return true;
  }

  private _handleInstall(): void {
    const installData: Record<string, any> = {
      entity_id: this.stateObj!.entity_id,
    };

    if (this._shouldCreateBackup) {
      installData.backup = true;
    }

    if (
      supportsFeature(this.stateObj!, UpdateEntityFeature.SPECIFIC_VERSION) &&
      this.stateObj!.attributes.latest_version
    ) {
      installData.version = this.stateObj!.attributes.latest_version;
    }

    this.hass.callService("update", "install", installData);
  }

  private _handleSkip(): void {
    if (this.stateObj!.attributes.auto_update) {
      showAlertDialog(this, {
        title: this.hass.localize(
          "ui.dialogs.more_info_control.update.auto_update_enabled_title"
        ),
        text: this.hass.localize(
          "ui.dialogs.more_info_control.update.auto_update_enabled_text"
        ),
      });
      return;
    }
    this.hass.callService("update", "skip", {
      entity_id: this.stateObj!.entity_id,
    });
  }

  private _handleClearSkipped(): void {
    this.hass.callService("update", "clear_skipped", {
      entity_id: this.stateObj!.entity_id,
    });
  }

  static get styles(): CSSResultGroup {
    return css`
      hr {
        border-color: var(--divider-color);
        border-bottom: none;
        margin: 16px 0;
      }
      ha-expansion-panel {
        margin: 16px 0;
      }
      .row {
        margin: 0;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      }
      .actions {
        border-top: 1px solid var(--divider-color);
        background: var(
          --ha-dialog-surface-background,
          var(--mdc-theme-surface, #fff)
        );
        margin: 8px 0 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        position: sticky;
        bottom: 0;
        padding: 12px 0;
        margin-bottom: -24px;
        z-index: 1;
      }

      .actions mwc-button {
        margin: 0 4px 4px;
      }
      a {
        color: var(--primary-color);
      }
      .flex.center {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      mwc-linear-progress {
        margin-bottom: -8px;
        margin-top: 4px;
      }
      ha-markdown {
        direction: ltr;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "more-info-update": MoreInfoUpdate;
  }
}
