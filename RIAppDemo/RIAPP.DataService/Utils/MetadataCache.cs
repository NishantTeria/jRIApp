using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;
using System.Text;

namespace RIAPP.DataService.Utils
{
    public class AssociationsDictionary : Dictionary<string, Association>
    {
        public AssociationsDictionary()
        {
        }
    }

    public class DbSetsDictionary : Dictionary<string, DbSetInfo>
    {
        public DbSetsDictionary()
        {
        }
    }


    public class ServiceMetadata
    {
        DbSetsDictionary _dbSets = new DbSetsDictionary();
        AssociationsDictionary _associations = new AssociationsDictionary();

        public ServiceMetadata() 
        {
        }

        public DbSetsDictionary dbSets { get { return _dbSets; } }
        public AssociationsDictionary associations { get { return _associations; } }
        public List<MethodDescription> methodDescriptions { get; set; }
      }


    public class MetadataCache : ConcurrentDictionary<Type, ServiceMetadata>
    {
        public MetadataCache()
        {
        }
    }

}
