import React from 'react';
import { useXRStore } from '@/stores';
import { Button } from '@/components/Button';
import {
  Container,
  ButtonsRow,
  InfoRow,
  Label,
  Value,
} from '@/components/XRPanel';

type TXRPanelProps = {
  onEnterXR: () => void;
  onExitXR: () => void;
  onAddObject: () => void;
};

export const XRPanel: React.FC<TXRPanelProps> = ({
  onEnterXR,
  onExitXR,
  onAddObject,
}) => {
  const selectedObject = useXRStore((s) => s.selectedObject);
  const hoveredObject = useXRStore((s) => s.hoveredObject);
  const polygonCount = useXRStore((s) => s.polygonCount);
  const isInXR = useXRStore((s) => s.isInXR);
  const xrSupported = useXRStore((s) => s.xrSupported);

  return (
    <Container>
      <ButtonsRow>
        <Button $variant="secondary" onClick={onAddObject}>
          Добавить вкусняшку
        </Button>

        <Button
          onClick={isInXR ? onExitXR : onEnterXR}
          disabled={xrSupported === false}
          $variant={xrSupported === false ? 'disabled' : 'secondary'}
        >
          {xrSupported === null
            ? 'Проверка XR...'
            : xrSupported === false
            ? ' XR не поддерживается'
            : isInXR
            ? 'Выйти из XR'
            : 'XR режим'}
        </Button>
      </ButtonsRow>

      {isInXR && (
        <>
          <InfoRow>
            <Label>Активная вкусняшка: </Label>
            <Value>
              {selectedObject !== null ? selectedObject : hoveredObject}
            </Value>
          </InfoRow>

          <InfoRow>
            <Label>Статус: </Label>
            {(selectedObject !== null || hoveredObject !== null) && (
              <>
                {selectedObject !== null ? (
                  <Value>выбран</Value>
                ) : (
                  <Value>наведен</Value>
                )}
              </>
            )}
          </InfoRow>

          <InfoRow>
            <Label>Полигонов: </Label>
            <Value>{polygonCount}</Value>
          </InfoRow>
        </>
      )}
    </Container>
  );
};
