import React from 'react';
import { Resource } from '../types';
import { Wheat, Mountain, Coins, Landmark } from 'lucide-react';
import { RESOURCE_COLORS } from '../constants';

interface ResourceIconProps {
  resource: Resource;
  size?: number;
  className?: string;
}

const ResourceIcon: React.FC<ResourceIconProps> = ({ resource, size = 16, className = '' }) => {
  const commonProps = {
    size,
    strokeWidth: 2,
    className: `drop-shadow-sm ${className}`,
    color: RESOURCE_COLORS[resource]
  };

  switch (resource) {
    case Resource.Grain:
      return <Wheat {...commonProps} />;
    case Resource.Stone:
      return <Mountain {...commonProps} />;
    case Resource.Gold:
      return <Coins {...commonProps} />;
    case Resource.Relic:
      return <Landmark {...commonProps} />;
    default:
      return null;
  }
};

export default ResourceIcon;